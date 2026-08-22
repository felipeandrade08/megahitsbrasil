module.exports.config = { api: { bodyParser: false } };
const Stripe = require('stripe');
const { ensureSchema, getPool } = require('../lib/db');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks);
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    await ensureSchema();
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const paid = session.payment_status === 'paid' || event.type === 'checkout.session.async_payment_succeeded';
      const email = String(session.customer_email || session.customer_details?.email || '').trim().toLowerCase();
      const whatsapp = String(session.metadata?.whatsapp || '').replace(/\D/g, '');
      const product = session.metadata?.product || 'megahitsbrasil_15gb';
      const amount = Number(session.amount_total || 990);
      const currency = session.currency || 'brl';

      await getPool().query(`
        INSERT INTO purchases
          (stripe_session_id, stripe_payment_intent, email, whatsapp, product, amount, currency, status, paid_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $8='paid' THEN NOW() ELSE NULL END,NOW())
        ON CONFLICT (stripe_session_id) DO UPDATE SET
          stripe_payment_intent=EXCLUDED.stripe_payment_intent,
          email=COALESCE(NULLIF(EXCLUDED.email,''), purchases.email),
          whatsapp=COALESCE(NULLIF(EXCLUDED.whatsapp,''), purchases.whatsapp),
          product=EXCLUDED.product,
          amount=EXCLUDED.amount,
          currency=EXCLUDED.currency,
          status=EXCLUDED.status,
          paid_at=CASE WHEN EXCLUDED.status='paid' THEN COALESCE(purchases.paid_at,NOW()) ELSE purchases.paid_at END,
          updated_at=NOW()
      `, [session.id, session.payment_intent || null, email, whatsapp, product, amount, currency, paid ? 'paid' : 'pending']);

      if (paid) console.log('Pagamento confirmado e salvo:', session.id, email);
    }
  } catch (e) {
    console.error('Erro ao salvar webhook:', e);
    return res.status(500).json({ error: 'Webhook recebido, mas não foi possível salvar o pedido.' });
  }

  return res.status(200).json({ received: true });
};
