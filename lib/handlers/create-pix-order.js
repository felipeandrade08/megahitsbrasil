const { ensureSchema, getPool } = require('../db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();

    const email = String(req.body?.email || '').trim().toLowerCase();
    const whatsapp = String(req.body?.whatsapp || '').replace(/\D/g, '');
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    if (whatsapp.length < 10) return res.status(400).json({ error: 'Informe um WhatsApp válido com DDD.' });

    const pool = getPool();
    let purchaseType = 'main';
    let product = 'megahitsbrasil_15gb';
    let amount = 990;
    let updateId = null;

    if (req.body?.updateId !== undefined && req.body?.updateId !== null && String(req.body.updateId) !== '') {
      const id = Number(req.body.updateId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Atualização inválida.' });

      const r = await pool.query(`SELECT id, active, price FROM updates WHERE id=$1`, [id]);
      if (!r.rowCount || !r.rows[0].active) return res.status(404).json({ error: 'Esta atualização não está disponível.' });

      purchaseType = 'update';
      updateId = id;
      product = `megahitsbrasil_update_${id}`;
      amount = Number(r.rows[0].price);
    }

    const existing = await pool.query(`
      SELECT id
      FROM purchases
      WHERE LOWER(email)=$1
        AND whatsapp=$2
        AND status='pending_pix'
        AND purchase_type=$3
        AND (update_id IS NOT DISTINCT FROM $4)
      ORDER BY created_at DESC
      LIMIT 1
    `, [email, whatsapp, purchaseType, updateId]);

    if (existing.rowCount) {
      return res.status(200).json({ ok: true, orderId: existing.rows[0].id, existing: true, amount });
    }

    const result = await pool.query(`
      INSERT INTO purchases
        (stripe_session_id,email,whatsapp,product,amount,currency,status,payment_method,purchase_type,update_id)
      VALUES ($1,$2,$3,$4,$5,'brl','pending_pix','pix',$6,$7)
      RETURNING id
    `, [
      `manual_pix_${Date.now()}_${Math.random().toString(36).slice(2,10)}`,
      email, whatsapp, product, amount, purchaseType, updateId
    ]);

    return res.status(200).json({ ok: true, orderId: result.rows[0].id, existing: false, amount });
  } catch (e) {
    console.error('[PIX] ERRO REAL:', e);
    return res.status(500).json({ error: 'PIX_ERROR', message: e?.message || String(e), code: e?.code || null });
  }
};
