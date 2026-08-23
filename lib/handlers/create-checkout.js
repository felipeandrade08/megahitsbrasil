const Stripe = require('stripe');
const { ensureSchema, getPool } = require('../db');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();

    const { email, whatsapp, updateId } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanWhatsapp = String(whatsapp || '').replace(/\D/g, '');

    if (!cleanEmail || !cleanEmail.includes('@')) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    if (cleanWhatsapp.length < 10) return res.status(400).json({ error: 'Informe um WhatsApp válido com DDD.' });

    const pool = getPool();
    let purchaseType = 'main';
    let product = 'megahitsbrasil_15gb';
    let amount = 990;
    let productName = 'MegaHitsBrasil — +15 GB de músicas';
    let productDescription = 'Pacote digital com mais de 15 GB de músicas';
    let update = null;

    if (updateId !== undefined && updateId !== null && String(updateId) !== '') {
      const id = Number(updateId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Atualização inválida.' });

      const r = await pool.query(
        `SELECT id, month_key, title, description, price, active FROM updates WHERE id=$1`,
        [id]
      );
      if (!r.rowCount || !r.rows[0].active) return res.status(404).json({ error: 'Esta atualização não está disponível.' });

      update = r.rows[0];
      purchaseType = 'update';
      product = `megahitsbrasil_update_${update.id}`;
      amount = Number(update.price);
      productName = `MegaHitsBrasil — ${update.title}`;
      productDescription = update.description || `Atualização mensal ${update.title}`;
    }

    const base = process.env.SITE_URL || 'https://megahitsbrasil.vercel.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: cleanEmail,
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: productName, description: productDescription },
          unit_amount: amount
        },
        quantity: 1
      }],
      payment_method_types: ['card'],
      metadata: {
        whatsapp: cleanWhatsapp,
        product,
        purchase_type: purchaseType,
        update_id: update ? String(update.id) : ''
      },
      success_url: `${base}/sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancelado`
    });

    await pool.query(`
      INSERT INTO purchases
        (stripe_session_id, email, whatsapp, product, amount, currency, status, payment_method, purchase_type, update_id)
      VALUES ($1,$2,$3,$4,$5,$6,'pending','card',$7,$8)
      ON CONFLICT (stripe_session_id) DO UPDATE SET
        email=EXCLUDED.email,
        whatsapp=EXCLUDED.whatsapp,
        product=EXCLUDED.product,
        amount=EXCLUDED.amount,
        purchase_type=EXCLUDED.purchase_type,
        update_id=EXCLUDED.update_id,
        updated_at=NOW()
    `, [
      session.id, cleanEmail, cleanWhatsapp, product, amount, 'brl',
      purchaseType, update ? update.id : null
    ]);

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Erro Stripe/DB:', error);
    return res.status(500).json({ error: 'Erro ao criar o pagamento. Verifique Stripe e Railway.' });
  }
};
