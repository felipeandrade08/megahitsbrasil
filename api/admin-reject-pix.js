const { ensureSchema, getPool } = require('./db');
const { requireAdmin } = require('./admin-auth');

module.exports = async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();
    const id = Number(req.body?.id);
    const note = String(req.body?.note || 'PIX recusado pelo administrador.').trim().slice(0, 500);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Pedido inválido.' });
    }

    const result = await getPool().query(`
      UPDATE purchases
      SET status='rejected',
          admin_note=$2,
          updated_at=NOW()
      WHERE id=$1 AND status='pending_pix'
      RETURNING id,email,whatsapp,status,admin_note
    `, [id, note]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Pedido PIX não encontrado ou já processado.' });
    }

    console.log(`PIX recusado pelo admin ${admin.email}: pedido ${id}`);
    return res.status(200).json({ ok: true, order: result.rows[0] });
  } catch (e) {
    console.error('Erro ao recusar PIX:', e);
    return res.status(500).json({ error: 'Não foi possível recusar o PIX.' });
  }
};
