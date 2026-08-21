const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req,res)=>{
  try{
    const id=req.query.session_id;
    if(!id) return res.status(400).send('Sessão ausente.');
    const s=await stripe.checkout.sessions.retrieve(id);
    if(s.payment_status!=='paid') return res.status(403).send('Pagamento ainda não confirmado.');
    const url=process.env.PRODUCT_DOWNLOAD_URL;
    if(!url) return res.status(503).send('A entrega ainda não foi configurada. Entre em contato pelo WhatsApp.');
    return res.redirect(302,url);
  }catch(e){
    console.error('Erro na entrega:',e.message);
    return res.status(400).send('Não foi possível validar este pedido.');
  }
};