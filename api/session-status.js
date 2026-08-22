const Stripe = require('stripe');
const { ensureSchema, getPool } = require('./db');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  try {
    const id = req.query.session_id;
    if (!id) return res.status(400).json({ error: 'session_id ausente' });
    const s = await stripe.checkout.sessions.retrieve(id);
    const paid = s.payment_status === 'paid';
    await ensureSchema();
    if (paid) {
      await getPool().query(`UPDATE purchases SET status='paid', paid_at=COALESCE(paid_at,NOW()), updated_at=NOW() WHERE stripe_session_id=$1`, [id]);
    }
    return res.status(200).json({ paid, status: s.payment_status, email: s.customer_email || '', product: s.metadata?.product || '', deliveryReady: Boolean(process.env.PRODUCT_DOWNLOAD_URL) });
  } catch (e) {
    console.error('Erro ao consultar sessão:', e.message);
    return res.status(400).json({ error: 'Sessão inválida' });
  }
};
