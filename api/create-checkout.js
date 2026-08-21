const Stripe = require('stripe');

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

module.exports = async (req, res) => {

  if (req.method !== 'POST') {

    return res.status(405).json({
      error: 'Method not allowed'
    });

  }


  try {

    const {
      email,
      whatsapp
    } = req.body || {};


    if (!email || !whatsapp) {

      return res.status(400).json({
        error:
          'E-mail e WhatsApp são obrigatórios.'
      });

    }


    const session =
      await stripe.checkout.sessions.create({

        mode: 'payment',

        customer_email: email,


        line_items: [

          {

            price_data: {

              currency: 'brl',

              product_data: {

                name:
                  'MegaHitsBrasil — +15 GB de músicas',

                description:
                  'Pacote digital com mais de 15 GB de músicas'

              },

              unit_amount: 990

            },

            quantity: 1

          }

        ],


        /*
         * POR ENQUANTO:
         * somente cartão.
         *
         * Quando você habilitar PIX no Stripe,
         * poderemos alterar para:
         *
         * ['card', 'pix']
         */

        payment_method_types: [
          'card'
        ],


        metadata: {

          whatsapp:
            String(whatsapp),

          product:
            'megahitsbrasil_15gb'

        },


        success_url:
          'https://megahitsbrasil.vercel.app/sucesso.html?session_id={CHECKOUT_SESSION_ID}',


        cancel_url:
          'https://megahitsbrasil.vercel.app/?checkout=cancelado'

      });


    return res.status(200).json({

      url:
        session.url

    });


  } catch (error) {

    console.error(
      'Erro Stripe:',
      error
    );


    return res.status(500).json({

      error:
        'Erro ao criar o pagamento. Verifique a configuração do Stripe.'

    });

  }

};