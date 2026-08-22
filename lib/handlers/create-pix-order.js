const { ensureSchema, getPool } = require('../db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();

    const email = String(req.body?.email || '').trim().toLowerCase();
    const whatsapp = String(req.body?.whatsapp || '').replace(/\D/g, '');

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (whatsapp.length < 10) {
      return res.status(400).json({ error: 'Informe um WhatsApp válido com DDD.' });
    }

    const existing = await getPool().query(`
      SELECT id
      FROM purchases
      WHERE LOWER(email)=$1
        AND whatsapp=$2
        AND status IN ('pending_pix','paid')
      ORDER BY created_at DESC
      LIMIT 1
    `, [email, whatsapp]);

    if (existing.rowCount && existing.rows[0]) {
      return res.status(200).json({
        ok: true,
        orderId: existing.rows[0].id,
        existing: true
      });
    }

    const result = await getPool().query(`
      INSERT INTO purchases
        (stripe_session_id, email, whatsapp, product, amount, currency, status, payment_method)
      VALUES ($1,$2,$3,$4,$5,$6,'pending_pix','pix')
      RETURNING id
    `, [`manual_pix_${Date.now()}_${Math.random().toString(36).slice(2,10)}`,
        email, whatsapp, 'megahitsbrasil_15gb', 990, 'brl']);

    return res.status(200).json({
      ok: true,
      orderId: result.rows[0].id,
      existing: false
    });
  } catch (e) {
    console.error('Erro ao criar pedido PIX:', e);
    return res.status(500).json({ error: 'Não foi possível registrar seu pedido PIX.' });
  }
};
