const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const {
      email,
      whatsapp,
      tipo_pagamento
    } = req.body || {};

    // Validação
    if (!email || !whatsapp) {
      return res.status(400).json({
        error: 'E-mail e WhatsApp são obrigatórios.'
      });
    }

    /*
     * ==========================================
     * PIX MANUAL
     * ==========================================
     *
     * O PIX manual NÃO passa pelo Stripe.
     *
     * Essa opção deve ser tratada pelo HTML:
     * - mostra QR Code
     * - mostra PIX copia e cola
     * - cliente faz o pagamento
     * - cliente envia comprovante pelo WhatsApp
     * - você libera o link manualmente
     */

    if (tipo_pagamento === 'pix_manual') {
      return res.status(200).json({
        tipo: 'pix_manual',
        mensagem: 'Pagamento PIX manual selecionado.'
      });
    }

    /*
     * ==========================================
     * STRIPE — PAGAMENTO AUTOMÁTICO
     * ==========================================
     */

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',

      customer_email: email,

      line_items: [
        {
          price_data: {
            currency: 'brl',

            product_data: {
              name: 'MegaHitsBrasil — +15 GB de músicas',
              description:
                'Pacote digital com mais de 15 GB de músicas'
            },

            unit_amount: 990
          },

          quantity: 1
        }
      ],

      /*
       * Cartão + PIX dentro do Stripe.
       *
       * IMPORTANTE:
       * O PIX precisa estar habilitado na conta Stripe.
       */

      payment_method_types: [
        'card',
        'pix'
      ],

      /*
       * Informações que serão utilizadas
       * pelo webhook para identificar o cliente.
       */

      metadata: {
        whatsapp: whatsapp,
        produto: 'megahitsbrasil_15gb',
        valor: '990',
        tipo_pagamento: 'stripe_automatico'
      },

      /*
       * Página exibida depois que o pagamento
       * for concluído.
       */

      success_url:
        'https://megahitsbrasil.vercel.app/sucesso.html?session_id={CHECKOUT_SESSION_ID}',

      /*
       * Caso o cliente cancele o checkout.
       */

      cancel_url:
        'https://megahitsbrasil.vercel.app/?checkout=cancelado'
    });

    return res.status(200).json({
      tipo: 'stripe',
      url: session.url
    });

  } catch (e) {

    console.error('Erro Stripe:', e);

    return res.status(500).json({
      error:
        'Erro ao criar o pagamento. Verifique a configuração do Stripe.'
    });
  }
};