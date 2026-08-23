const Stripe = require('stripe');
const crypto = require('crypto');
const { ensureSchema, getPool } = require('../db');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function verifyToken(req) {
  try {
    const raw = req.headers.cookie || '';
    const item = raw.split(';').map(v => v.trim()).find(v => v.startsWith('mh_access='));
    const token = item ? decodeURIComponent(item.slice('mh_access='.length)) : null;
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!token || !secret) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return null;
    const payload = JSON.parse(Buffer.from(body,'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}

module.exports = async (req, res) => {
  try {
    await ensureSchema();
    const pool = getPool();
    const token = verifyToken(req);

    // Acesso normal pela Área do Cliente.
    if (token) {
      let email = String(token.email || '').trim().toLowerCase();
      let whatsapp = String(token.whatsapp || '').replace(/\D/g, '');

      if ((!email || !whatsapp) && token.purchaseId) {
        const old = await pool.query(`SELECT email,whatsapp FROM purchases WHERE id=$1`, [token.purchaseId]);
        if (old.rowCount) {
          email = old.rows[0].email;
          whatsapp = old.rows[0].whatsapp;
        }
      }

      if (email && whatsapp) {
        const updateId = req.query?.update_id ? Number(req.query.update_id) : null;
        const purchaseId = req.query?.purchase_id ? Number(req.query.purchase_id) : null;

        if (updateId) {
          const r = await pool.query(`
            SELECT p.id,u.download_url,u.active
            FROM purchases p
            JOIN updates u ON u.id=p.update_id
            WHERE p.update_id=$1 AND p.id=COALESCE($2,p.id)
              AND LOWER(p.email)=$3 AND p.whatsapp=$4
              AND p.status='paid' AND p.access_blocked=false
            LIMIT 1
          `, [updateId, Number.isInteger(purchaseId) ? purchaseId : null, email, whatsapp]);
          if (!r.rowCount || !r.rows[0].active) return res.status(403).send('Esta atualização não está disponível para sua conta.');
          return res.redirect(302, r.rows[0].download_url);
        }

        const r = await pool.query(`
          SELECT id FROM purchases
          WHERE LOWER(email)=$1 AND whatsapp=$2 AND status='paid'
            AND purchase_type<>'update' AND access_blocked=false
          ORDER BY paid_at DESC NULLS LAST LIMIT 1
        `, [email,whatsapp]);

        if (r.rowCount) {
          const url = process.env.PRODUCT_DOWNLOAD_URL;
          if (!url) return res.status(503).send('A entrega principal ainda não foi configurada.');
          return res.redirect(302,url);
        }
      }
    }

    // Liberação logo após o Stripe voltar para sucesso.html.
    const sessionId = String(req.query?.session_id || '');
    if (sessionId) {
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      if (s.payment_status !== 'paid') return res.status(403).send('Pagamento ainda não confirmado.');

      const purchaseType = s.metadata?.purchase_type === 'update' ? 'update' : 'main';
      const updateId = s.metadata?.update_id && /^\d+$/.test(s.metadata.update_id) ? Number(s.metadata.update_id) : null;

      await pool.query(`
        UPDATE purchases
        SET status='paid', paid_at=COALESCE(paid_at,NOW()), updated_at=NOW()
        WHERE stripe_session_id=$1
      `, [sessionId]);

      if (purchaseType === 'update' && updateId) {
        const r = await pool.query(`SELECT download_url,active FROM updates WHERE id=$1`, [updateId]);
        if (!r.rowCount || !r.rows[0].active) return res.status(404).send('Atualização não encontrada.');
        return res.redirect(302,r.rows[0].download_url);
      }

      const url = process.env.PRODUCT_DOWNLOAD_URL;
      if (!url) return res.status(503).send('A entrega principal ainda não foi configurada.');
      return res.redirect(302,url);
    }

    return res.status(401).send('Acesso não autorizado. Entre em Minha Compra para continuar.');
  } catch (e) {
    console.error('Erro na entrega:', e);
    return res.status(400).send('Não foi possível validar este acesso.');
  }
};
