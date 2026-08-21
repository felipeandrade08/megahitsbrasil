const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
module.exports = async (req,res)=>{
  try{
    const id=req.query.session_id;
    if(!id) return res.status(400).json({error:'session_id ausente'});
    const s=await stripe.checkout.sessions.retrieve(id);
    const paid=s.payment_status==='paid';
    return res.status(200).json({paid, status:s.payment_status, email:s.customer_email || '', product:s.metadata?.product || ''});
  }catch(e){return res.status(400).json({error:'Sessão inválida'});}
};
