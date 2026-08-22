const crypto = require('crypto');
const { ensureSchema, getPool } = require('../lib/db');

function verify(token) {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret || !token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

function cookie(req, name) {
  const raw = req.headers.cookie || '';
  const found = raw.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

module.exports = async (req, res) => {
  try {
    await ensureSchema();
    const payload = verify(cookie(req, 'mh_access'));
    if (!payload) return res.status(401).json({ authenticated: false });
    const result = await getPool().query(`SELECT id,email,product,amount,currency,status,paid_at FROM purchases WHERE id=$1 AND status='paid'`, [payload.purchaseId]);
    if (!result.rowCount) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, purchase: result.rows[0] });
  } catch (e) {
    console.error('Erro minha compra:', e);
    return res.status(500).json({ error: 'Não foi possível carregar sua compra.' });
  }
};
