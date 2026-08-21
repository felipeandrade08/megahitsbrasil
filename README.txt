MEGAHITSBRASIL — VERSÃO PROFISSIONAL

Alterações:
- Landing page reorganizada para conversão.
- Logo preparada para ficar sem o fundo quadrado original.
- Cabeçalho, oferta, confiança, conteúdo, FAQ e rodapé redesenhados.
- CTA mais claro e repetido em pontos estratégicos.
- Checkout Stripe continua somente com cartão.
- Página sucesso atualizada para confirmar o pagamento automaticamente.
- Nova API /api/download valida o pagamento no Stripe antes de redirecionar para o conteúdo.

ENTREGA AUTOMÁTICA:
No Vercel, além de STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET, crie:

PRODUCT_DOWNLOAD_URL = URL FINAL DO SEU CONTEÚDO

Exemplo:
PRODUCT_DOWNLOAD_URL=https://seu-servidor-ou-provedor.com/seu-arquivo-ou-link

O cliente só consegue passar por /api/download se a sessão do Stripe estiver com payment_status=paid.

WEBHOOK:
Endpoint:
https://megahitsbrasil.vercel.app/api/webhook

Evento:
checkout.session.completed

O Stripe continua configurado somente para cartão nesta versão.

IMPORTANTE:
Não coloque STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET ou PRODUCT_DOWNLOAD_URL dentro do HTML/JavaScript do navegador.
