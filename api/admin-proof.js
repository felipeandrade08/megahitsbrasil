const { ensureSchema, getPool } = require('./db');
const { requireAdmin } = require('./admin-auth');
module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await ensureSchema();
    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).send('Pedido inválido.');
    const r = await getPool().query('SELECT proof_data, proof_mime, proof_name FROM purchases WHERE id=$1', [id]);
    if (!r.rowCount || !r.rows[0].proof_data) return res.status(404).send('Comprovante não encontrado.');
    const row = r.rows[0];
    res.setHeader('Content-Type', row.proof_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${String(row.proof_name || 'comprovante').replace(/[^a-zA-Z0-9._-]/g,'_')}"`);
    return res.status(200).send(row.proof_data);
  } catch (e) { console.error(e); return res.status(500).send('Erro ao abrir comprovante.'); }
};
