const { ensureSchema, getPool } = require('../db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await ensureSchema();
    const r = await getPool().query(`
      SELECT id, month_key, title, description, price, currency
      FROM updates
      WHERE active=true
      ORDER BY month_key DESC, id DESC
    `);
    return res.status(200).json({ ok: true, updates: r.rows });
  } catch (e) {
    console.error('Erro atualizações públicas:', e);
    return res.status(500).json({ error: 'Não foi possível carregar as atualizações.' });
  }
};
