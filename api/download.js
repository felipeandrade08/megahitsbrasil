const Stripe = require('stripe');
const crypto = require('crypto');
const { ensureSchema, getPool } = require('../lib/db');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function verifyToken(req) {
  const raw = req.headers.cookie || '';
  const item = raw.split(';').map(v => v.trim()).find(v => v.startsWith('mh_access='));
  const token = item ? decodeURIComponent(item.slice('mh_access='.length)) : null;
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!token || !secret) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  return payload.exp > Date.now() ? payload : null;
}

module.exports = async (req, res) => {
  try {
    await ensureSchema();
    const url = process.env.PRODUCT_DOWNLOAD_URL;
    if (!url) return res.status(503).send('A entrega ainda não foi configurada.');

    const tokenPayload = verifyToken(req);
    if (tokenPayload) {
      const result = await getPool().query(`SELECT id FROM purchases WHERE id=$1 AND status='paid'`, [tokenPayload.purchaseId]);
      if (result.rowCount) return res.redirect(302, url);
    }

    const id = req.query.session_id;
    if (!id) return res.status(401).send('Acesso não autorizado. Entre em Minha Compra para continuar.');
    const s = await stripe.checkout.sessions.retrieve(id);
    if (s.payment_status !== 'paid') return res.status(403).send('Pagamento ainda não confirmado.');
    await getPool().query(`UPDATE purchases SET status='paid', paid_at=COALESCE(paid_at,NOW()), updated_at=NOW() WHERE stripe_session_id=$1`, [id]);
    return res.redirect(302, url);
  } catch (e) {
    console.error('Erro na entrega:', e.message);
    return res.status(400).send('Não foi possível validar este pedido.');
  }
};
