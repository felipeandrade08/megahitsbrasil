module.exports.config = { api: { bodyParser: false } };
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req,res)=>{
  const sig=req.headers['stripe-signature'];
  let event;
  try{
    const chunks=[];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw=Buffer.concat(chunks);
    event=stripe.webhooks.constructEvent(raw,sig,process.env.STRIPE_WEBHOOK_SECRET);
  }catch(e){
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
  if(event.type==='checkout.session.completed'){
    const session=event.data.object;
    if(session.payment_status==='paid'){
      console.log('Pagamento confirmado:',session.id,session.customer_email,session.metadata?.whatsapp);
    }
  }
  return res.status(200).json({received:true});
};