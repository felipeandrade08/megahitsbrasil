const crypto = require('crypto');
const { ensureSchema, getPool } = require('../db');

function verify(token) {
  try {
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret || !token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function cookie(req, name) {
  const raw = req.headers.cookie || '';
  const found = raw.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

module.exports = async (req, res) => {
  try {
    await ensureSchema();
    let payload = verify(cookie(req, 'mh_access'));
    if (!payload) return res.status(401).json({ authenticated: false });

    const pool = getPool();
    let email = String(payload.email || '').trim().toLowerCase();
    let whatsapp = String(payload.whatsapp || '').replace(/\D/g, '');

    // Compatibilidade com sessões antigas que guardavam apenas purchaseId.
    if ((!email || !whatsapp) && payload.purchaseId) {
      const old = await pool.query(`SELECT email,whatsapp FROM purchases WHERE id=$1`, [payload.purchaseId]);
      if (!old.rowCount) return res.status(401).json({ authenticated: false });
      email = old.rows[0].email;
      whatsapp = old.rows[0].whatsapp;
    }

    if (!email || !whatsapp) return res.status(401).json({ authenticated: false });

    const purchases = await pool.query(`
      SELECT
        p.id,p.email,p.whatsapp,p.product,p.amount,p.currency,p.status,p.payment_method,
        p.paid_at,p.created_at,p.purchase_type,p.update_id,p.access_blocked,
        u.month_key,u.title AS update_title,u.description AS update_description
      FROM purchases p
      LEFT JOIN updates u ON u.id=p.update_id
      WHERE LOWER(p.email)=$1 AND p.whatsapp=$2 AND p.status='paid' AND p.access_blocked=false
      ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
    `, [email, whatsapp]);

    if (!purchases.rowCount) return res.status(401).json({ authenticated: false });

    const rows = purchases.rows;
    const main = rows.find(r => r.purchase_type !== 'update') || null;
    const updates = rows.filter(r => r.purchase_type === 'update').map(r => ({
      purchaseId: r.id,
      updateId: r.update_id,
      monthKey: r.month_key,
      title: r.update_title || r.product,
      description: r.update_description || '',
      amount: r.amount,
      paidAt: r.paid_at
    }));

    return res.status(200).json({
      authenticated: true,
      customer: { email, whatsapp },
      purchase: main,
      updates
    });
  } catch (e) {
    console.error('Erro minha compra:', e);
    return res.status(500).json({ error: 'Não foi possível carregar sua compra.' });
  }
};
