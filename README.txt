MEGAHITSBRASIL — V3 PROFISSIONAL

OBJETIVO DA V3
- Manter o Stripe e a entrega automática existentes.
- Adicionar banco PostgreSQL no Railway para registrar pedidos de forma persistente.
- Permitir que o cliente feche o site e recupere a compra depois em /minha-compra.html.
- Criar sessão segura por cookie HttpOnly após validação de e-mail + WhatsApp usados na compra.
- Manter /api/download validando pedido pago antes da entrega.

ARQUITETURA
Cliente -> Vercel -> Stripe Checkout -> Webhook -> PostgreSQL Railway
                                           |
                                           +-> pedido PAID

Cliente pode voltar depois -> /minha-compra.html -> e-mail + WhatsApp -> cookie seguro -> /api/download

RAILWAY — CONFIGURAÇÃO
1. Crie um projeto no Railway.
2. Adicione um serviço PostgreSQL (Postgres).
3. O Railway fornecerá DATABASE_URL nas variáveis do serviço/conexão.
4. Na Vercel, abra o projeto MegaHitsBrasil > Settings > Environment Variables.
5. Adicione DATABASE_URL com o valor fornecido pelo Railway.
6. O banco cria a tabela purchases automaticamente na primeira chamada de qualquer API.

VARIÁVEIS DA VERCEL
STRIPE_SECRET_KEY=chave LIVE do Stripe
STRIPE_WEBHOOK_SECRET=segredo do webhook LIVE
PRODUCT_DOWNLOAD_URL=URL final do conteúdo
DATABASE_URL=URL PostgreSQL do Railway
ACCESS_TOKEN_SECRET=uma senha aleatória longa, usada para assinar sessões de acesso

NÃO COLOQUE essas variáveis no HTML ou JavaScript do navegador.

WEBHOOK STRIPE
Endpoint:
https://megahitsbrasil.vercel.app/api/webhook

Evento mínimo:
checkout.session.completed

A V3 também aceita:
checkout.session.async_payment_succeeded

FLUXO DO PEDIDO
1. /api/create-checkout cria o Checkout Stripe e grava um pedido PENDING no Railway.
2. Stripe confirma o pagamento.
3. /api/webhook muda o pedido para PAID.
4. /api/session-status também sincroniza PAID quando a página de sucesso consulta o Stripe.
5. /minha-compra.html permite recuperar o pedido aprovado.
6. /api/download valida o pedido e libera PRODUCT_DOWNLOAD_URL.

IMPORTANTE SOBRE A ENTREGA
PRODUCT_DOWNLOAD_URL ainda aponta para o conteúdo final. Se esse endereço for um link público (ex.: Drive), quem obtiver o endereço final poderá compartilhá-lo. A V3 protege a entrada e a validação, mas não transforma um arquivo público em arquivo privado.

Para uma V4, recomenda-se usar armazenamento com URLs assinadas/temporárias para que cada download tenha validade limitada.

IMPORTANTE SOBRE O LOGIN
A V3 usa e-mail + WhatsApp informados na compra para recuperar o pedido, sem exigir outro provedor de e-mail. Isso é simples de operar, mas a versão mais forte seria V4 com código OTP enviado por e-mail.

TESTE OBRIGATÓRIO
- Faça uma compra de teste no ambiente apropriado.
- Confirme que o pedido aparece como PAID no Railway.
- Abra /minha-compra.html.
- Informe o mesmo e-mail e WhatsApp da compra.
- Confirme que o botão "Acessar meu produto" funciona.
- Feche o site, abra novamente e repita o acesso.

VERSÃO: 3.0.0


=== PAINEL ADMINISTRATIVO + PIX MANUAL ===

Nova área administrativa:
  /admin/login.html
  /admin/dashboard.html

Variáveis de ambiente obrigatórias no Vercel:
  DATABASE_URL
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  ACCESS_TOKEN_SECRET
  PRODUCT_DOWNLOAD_URL
  ADMIN_EMAIL
  ADMIN_PASSWORD
  ADMIN_SESSION_SECRET (opcional; se ausente usa ACCESS_TOKEN_SECRET)

Fluxo PIX:
  1. Cliente informa e-mail + WhatsApp e escolhe PIX.
  2. O site registra o pedido como pending_pix.
  3. Cliente paga e envia comprovante pelo WhatsApp.
  4. Administrador entra em /admin/login.html.
  5. Em Pedidos, clica em Aprovar.
  6. O pedido passa para paid e o login da Área do Cliente é liberado.

Importante:
  - Nunca coloque ADMIN_EMAIL/ADMIN_PASSWORD no HTML ou JavaScript.
  - Configure essas variáveis somente no ambiente do backend/Vercel.
  - Use uma senha forte e exclusiva.
