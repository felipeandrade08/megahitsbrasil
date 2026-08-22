const { ensureSchema, getPool } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await ensureSchema();
    const id = Number(req.body?.id);
    const mime = String(req.body?.mime || '').toLowerCase();
    const name = String(req.body?.name || 'comprovante').slice(0, 120);
    const data = String(req.body?.data || '');
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Pedido inválido.' });
    if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(mime)) return res.status(400).json({ error: 'Envie JPG, PNG, WEBP ou PDF.' });
    const raw = data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    if (!buffer.length || buffer.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'O comprovante deve ter até 2 MB.' });
    const result = await getPool().query(`UPDATE purchases SET proof_data=$2, proof_mime=$3, proof_name=$4, proof_uploaded_at=NOW(), updated_at=NOW() WHERE id=$1 AND status='pending_pix' RETURNING id`, [id, buffer, mime, name]);
    if (!result.rowCount) return res.status(404).json({ error: 'Pedido PIX não encontrado ou já processado.' });
    return res.status(200).json({ ok: true, orderId: id });
  } catch (e) { console.error('Erro upload comprovante:', e); return res.status(500).json({ error: 'Não foi possível enviar o comprovante.' }); }
};
