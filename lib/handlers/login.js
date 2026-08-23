const crypto = require('crypto');
const { ensureSchema, getPool } = require('../db');

function sign(payload) {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error('ACCESS_TOKEN_SECRET não configurado.');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();

    const email = String(req.body?.email || '').trim().toLowerCase();
    const whatsapp = String(req.body?.whatsapp || '').replace(/\D/g, '');
    if (!email || whatsapp.length < 10) return res.status(400).json({ error: 'Informe e-mail e WhatsApp usados na compra.' });

    const result = await getPool().query(`
      SELECT id, email, whatsapp, product, amount, currency, paid_at, access_blocked
      FROM purchases
      WHERE LOWER(email)=$1 AND whatsapp=$2 AND status='paid' AND access_blocked=false
      ORDER BY paid_at DESC NULLS LAST
      LIMIT 1
    `, [email, whatsapp]);

    if (!result.rowCount) return res.status(401).json({ error: 'Não encontramos uma compra aprovada com esses dados.' });

    const order = result.rows[0];
    const token = sign({
      purchaseId: order.id,
      email: order.email,
      whatsapp: order.whatsapp,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 30
    });

    res.setHeader('Set-Cookie', `mh_access=${token}; Path=/; Max-Age=${60*60*24*30}; HttpOnly; SameSite=Lax; Secure`);
    return res.status(200).json({ ok: true, product: order.product, paidAt: order.paid_at });
  } catch (e) {
    console.error('Erro login:', e);
    return res.status(500).json({ error: 'Não foi possível recuperar sua compra.' });
  }
};
