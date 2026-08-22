const { ensureSchema, getPool } = require('./db');
const { requireAdmin } = require('./admin-auth');
module.exports = async (req,res)=>{
  const admin=requireAdmin(req,res); if(!admin)return;
  try{
    await ensureSchema();
    const q=String(req.query?.q||'').trim().toLowerCase();
    const status=String(req.query?.status||'all');
    const params=[]; const where=[];
    if(q){params.push(`%${q}%`); where.push(`(LOWER(email) LIKE $${params.length} OR whatsapp LIKE $${params.length} OR CAST(id AS TEXT) LIKE $${params.length})`);}
    if(['pending_pix','paid','rejected','pending'].includes(status)){params.push(status);where.push(`status=$${params.length}`);}
    const whereSql=where.length?`WHERE ${where.join(' AND ')}`:'';
    const result=await getPool().query(`SELECT id,email,whatsapp,product,amount,currency,status,payment_method,admin_note,created_at,paid_at,updated_at,(proof_data IS NOT NULL) AS has_proof,proof_uploaded_at,access_blocked FROM purchases ${whereSql} ORDER BY CASE WHEN status='pending_pix' THEN 0 WHEN status='paid' THEN 1 ELSE 2 END,created_at DESC LIMIT 300`,params);
    const stats=await getPool().query(`SELECT COUNT(*) FILTER(WHERE status='paid')::int AS paid,COUNT(*) FILTER(WHERE status='pending_pix')::int AS pending_pix,COUNT(*) FILTER(WHERE status='pending')::int AS pending,COUNT(*) FILTER(WHERE status='rejected')::int AS rejected,COALESCE(SUM(amount) FILTER(WHERE status='paid'),0)::int AS revenue,COUNT(*) FILTER(WHERE status='paid' AND access_blocked=true)::int AS blocked FROM purchases`);
    return res.status(200).json({ok:true,adminEmail:admin.email,orders:result.rows,stats:stats.rows[0]});
  }catch(e){console.error('Erro admin pedidos:',e);return res.status(500).json({error:'Não foi possível carregar os pedidos.'});}
};
