const { ensureSchema, getPool } = require('../lib/db');
const {
  setAdminCookie,
  clearAdminCookie,
  getAdmin,
  requireAdmin,
  safeEqual
} = require('../lib/admin-auth');

function send(res, status, data) {
  return res.status(status).json(data);
}

function action(req) {
  return String(req.query?.action || req.body?.action || '').trim().toLowerCase();
}

module.exports = async (req, res) => {
  const op = action(req);

  // Login não exige sessão.
  if (op === 'login') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

    const configuredEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const configuredPassword = String(process.env.ADMIN_PASSWORD || '');
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!configuredEmail || !configuredPassword) {
      return send(res, 503, {
        error: 'Administrador não configurado. Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente.'
      });
    }

    if (!safeEqual(email, configuredEmail) || !safeEqual(password, configuredPassword)) {
      return send(res, 401, { error: 'E-mail ou senha de administrador inválidos.' });
    }

    setAdminCookie(res, {
      role: 'admin',
      email: configuredEmail,
      exp: Date.now() + 1000 * 60 * 60 * 8
    });

    return send(res, 200, { ok: true, email: configuredEmail });
  }

  if (op === 'logout') {
    clearAdminCookie(res);
    return send(res, 200, { ok: true });
  }

  if (op === 'me') {
    const admin = getAdmin(req);
    if (!admin) return send(res, 401, { authenticated: false });
    return send(res, 200, { authenticated: true, email: admin.email });
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  try {
    await ensureSchema();
    const pool = getPool();

    if (op === 'orders') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

      const q = String(req.query?.q || '').trim().toLowerCase();
      const status = String(req.query?.status || 'all');
      const params = [];
      const where = [];

      if (q) {
        params.push(`%${q}%`);
        where.push(`(LOWER(email) LIKE $${params.length} OR whatsapp LIKE $${params.length} OR CAST(id AS TEXT) LIKE $${params.length})`);
      }

      if (['pending_pix', 'paid', 'rejected', 'pending'].includes(status)) {
        params.push(status);
        where.push(`status=$${params.length}`);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const result = await pool.query(`
        SELECT id,email,whatsapp,product,amount,currency,status,payment_method,
               admin_note,created_at,paid_at,updated_at,
               (proof_data IS NOT NULL) AS has_proof,
               proof_uploaded_at,access_blocked
        FROM purchases
        ${whereSql}
        ORDER BY CASE WHEN status='pending_pix' THEN 0 WHEN status='paid' THEN 1 ELSE 2 END,
                 created_at DESC
        LIMIT 300
      `, params);

      const stats = await pool.query(`
        SELECT
          COUNT(*) FILTER(WHERE status='paid')::int AS paid,
          COUNT(*) FILTER(WHERE status='pending_pix')::int AS pending_pix,
          COUNT(*) FILTER(WHERE status='pending')::int AS pending,
          COUNT(*) FILTER(WHERE status='rejected')::int AS rejected,
          COALESCE(SUM(amount) FILTER(WHERE status='paid'),0)::int AS revenue,
          COUNT(*) FILTER(WHERE status='paid' AND access_blocked=true)::int AS blocked
        FROM purchases
      `);

      return send(res, 200, {
        ok: true,
        adminEmail: admin.email,
        orders: result.rows,
        stats: stats.rows[0]
      });
    }

    if (op === 'approve-pix') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

      const id = Number(req.body?.id);
      const note = String(req.body?.note || '').trim().slice(0, 500);
      if (!Number.isInteger(id) || id <= 0) return send(res, 400, { error: 'Pedido inválido.' });

      const result = await pool.query(`
        UPDATE purchases
        SET status='paid',
            payment_method='pix',
            paid_at=COALESCE(paid_at,NOW()),
            admin_note=$2,
            updated_at=NOW()
        WHERE id=$1 AND status='pending_pix'
        RETURNING id,email,whatsapp,status,paid_at
      `, [id, note]);

      if (!result.rowCount) {
        return send(res, 404, { error: 'Pedido PIX não encontrado ou já processado.' });
      }

      const o = result.rows[0];
      const base = process.env.SITE_URL || 'https://megahitsbrasil.vercel.app';
      const msg = `Olá! Seu pagamento do MegaHitsBrasil foi aprovado. 🎉\n\nPedido #${o.id}\nAcesso liberado!\n\nAcesse sua área do cliente: ${base}/minha-compra.html`;
      const phone = String(o.whatsapp || '').replace(/\D/g, '');
      const whatsappUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
        : null;

      console.log(`PIX aprovado pelo admin ${admin.email}: pedido ${id}`);
      return send(res, 200, { ok: true, order: o, whatsappUrl });
    }

    if (op === 'reject-pix') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

      const id = Number(req.body?.id);
      const note = String(req.body?.note || 'PIX recusado pelo administrador.').trim().slice(0, 500);
      if (!Number.isInteger(id) || id <= 0) return send(res, 400, { error: 'Pedido inválido.' });

      const result = await pool.query(`
        UPDATE purchases
        SET status='rejected', admin_note=$2, updated_at=NOW()
        WHERE id=$1 AND status='pending_pix'
        RETURNING id,email,whatsapp,status,admin_note
      `, [id, note]);

      if (!result.rowCount) {
        return send(res, 404, { error: 'Pedido PIX não encontrado ou já processado.' });
      }

      console.log(`PIX recusado pelo admin ${admin.email}: pedido ${id}`);
      return send(res, 200, { ok: true, order: result.rows[0] });
    }

    if (op === 'toggle-customer') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

      const id = Number(req.body?.id);
      const blocked = Boolean(req.body?.blocked);
      if (!Number.isInteger(id) || id <= 0) return send(res, 400, { error: 'Cliente inválido.' });

      const r = await pool.query(`
        UPDATE purchases
        SET access_blocked=$2,
            blocked_at=CASE WHEN $2 THEN NOW() ELSE NULL END,
            updated_at=NOW()
        WHERE id=$1 AND status='paid'
        RETURNING id,email,whatsapp,access_blocked
      `, [id, blocked]);

      if (!r.rowCount) return send(res, 404, { error: 'Cliente aprovado não encontrado.' });
      return send(res, 200, { ok: true, customer: r.rows[0] });
    }

    if (op === 'proof') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

      const id = Number(req.query?.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).send('Pedido inválido.');

      const r = await pool.query(
        'SELECT proof_data, proof_mime, proof_name FROM purchases WHERE id=$1',
        [id]
      );
      if (!r.rowCount || !r.rows[0].proof_data) return res.status(404).send('Comprovante não encontrado.');

      const row = r.rows[0];
      res.setHeader('Content-Type', row.proof_mime || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${String(row.proof_name || 'comprovante').replace(/[^a-zA-Z0-9._-]/g, '_')}"`
      );
      return res.status(200).send(row.proof_data);
    }

    return send(res, 400, { error: 'Ação administrativa inválida.' });
  } catch (e) {
    console.error('Erro API admin:', e);
    return send(res, 500, { error: 'Não foi possível concluir a operação administrativa.' });
  }
};
