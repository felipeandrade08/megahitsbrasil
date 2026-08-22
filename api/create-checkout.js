const Stripe = require('stripe');
const { ensureSchema, getPool } = require('../lib/db');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await ensureSchema();
    const { email, whatsapp } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanWhatsapp = String(whatsapp || '').replace(/\D/g, '');
    if (!cleanEmail || !cleanEmail.includes('@')) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    if (cleanWhatsapp.length < 10) return res.status(400).json({ error: 'Informe um WhatsApp válido com DDD.' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: cleanEmail,
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: 'MegaHitsBrasil — +15 GB de músicas',
            description: 'Pacote digital com mais de 15 GB de músicas'
          },
          unit_amount: 990
        },
        quantity: 1
      }],
      payment_method_types: ['card'],
      metadata: { whatsapp: cleanWhatsapp, product: 'megahitsbrasil_15gb' },
      success_url: 'https://megahitsbrasil.vercel.app/sucesso.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://megahitsbrasil.vercel.app/?checkout=cancelado'
    });

    const pool = getPool();
    await pool.query(`
      INSERT INTO purchases (stripe_session_id, email, whatsapp, product, amount, currency, status)
      VALUES ($1,$2,$3,$4,$5,$6,'pending')
      ON CONFLICT (stripe_session_id) DO UPDATE SET email=EXCLUDED.email, whatsapp=EXCLUDED.whatsapp, updated_at=NOW()
    `, [session.id, cleanEmail, cleanWhatsapp, 'megahitsbrasil_15gb', 990, 'brl']);

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Erro Stripe/DB:', error);
    return res.status(500).json({ error: 'Erro ao criar o pagamento. Verifique Stripe e Railway.' });
  }
};
