const { ensureSchema, getPool } = require('./db');
const { requireAdmin } = require('./admin-auth');

module.exports = async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();
    const id = Number(req.body?.id);
    const note = String(req.body?.note || '').trim().slice(0, 500);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Pedido inválido.' });
    }

    const result = await getPool().query(`
      UPDATE purchases
      SET status='paid',
          payment_method='pix',
          paid_at=COALESCE(paid_at,NOW()),
          admin_note=$2,
          updated_at=NOW()
      WHERE id=$1 AND status='pending_pix'
      RETURNING id,email,whatsapp,status,paid_at
    `, [id, note]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Pedido PIX não encontrado ou já processado.' });
    }

    console.log(`PIX aprovado pelo admin ${admin.email}: pedido ${id}`);
    const o=result.rows[0];
    const msg=`Olá! Seu pagamento do MegaHitsBrasil foi aprovado. 🎉\n\nPedido #${o.id}\nAcesso liberado!\n\nAcesse sua área do cliente: ${process.env.SITE_URL || ''}/minha-compra.html`;
    const waUrl=`https://wa.me/${String(o.whatsapp).replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
    return res.status(200).json({ ok: true, order:o, whatsappUrl:waUrl });
  } catch (e) {
    console.error('Erro ao aprovar PIX:', e);
    return res.status(500).json({ error: 'Não foi possível aprovar o PIX.' });
  }
};
