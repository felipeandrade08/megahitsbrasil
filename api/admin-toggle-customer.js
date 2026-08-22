const { ensureSchema, getPool } = require('./db');
const { requireAdmin } = require('./admin-auth');
module.exports = async (req,res)=>{
  const admin=requireAdmin(req,res); if(!admin)return;
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    await ensureSchema();
    const id=Number(req.body?.id), blocked=Boolean(req.body?.blocked);
    if(!Number.isInteger(id)||id<=0)return res.status(400).json({error:'Cliente inválido.'});
    const r=await getPool().query(`UPDATE purchases SET access_blocked=$2, blocked_at=CASE WHEN $2 THEN NOW() ELSE NULL END, updated_at=NOW() WHERE id=$1 AND status='paid' RETURNING id,email,whatsapp,access_blocked`,[id,blocked]);
    if(!r.rowCount)return res.status(404).json({error:'Cliente aprovado não encontrado.'});
    return res.status(200).json({ok:true,customer:r.rows[0]});
  }catch(e){console.error(e);return res.status(500).json({error:'Não foi possível alterar o acesso.'});}
};
