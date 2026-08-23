MEGAHITSBRASIL — ATUALIZAÇÕES MENSAIS

O projeto foi atualizado para suportar:

1. Produto principal (+15 GB)
2. Atualizações mensais independentes
3. Preço padrão de R$ 4,90 por atualização
4. Link MEGA individual por mês
5. Compra de atualização pelo Stripe
6. Liberação automática após pagamento confirmado
7. Área do cliente com atualizações compradas
8. Tutorial de acesso ao MEGA no celular e computador
9. Painel admin para criar, editar, publicar e desativar atualizações

COMO PUBLICAR

1. Substitua os arquivos do seu projeto pelos arquivos deste ZIP.
2. Não apague as variáveis da Vercel.
3. Faça commit e push:
   git add .
   git commit -m "sistema de atualizacoes mensais e entrega MEGA"
   git push origin main
4. Aguarde o deploy da Vercel.
5. No painel Admin, abra "Atualizações mensais".
6. Cadastre:
   - Mês: 2026-09
   - Título: Atualização Setembro/2026
   - Descrição
   - Preço: 4.90
   - Link da pasta no MEGA
7. Clique em "Criar atualização" e depois "Publicar".

COMPRAS

O cliente compra cada mês separadamente. Comprar agosto não libera setembro.
Cada atualização tem seu próprio pedido, valor e acesso.

ENTREGA

O produto principal usa PRODUCT_DOWNLOAD_URL.
As atualizações usam o link MEGA cadastrado no painel Admin.
O link do MEGA não fica exposto na página pública de atualizações; ele é usado pelo endpoint protegido depois que a compra é validada.

IMPORTANTE SOBRE PIX

O fluxo PIX manual existente continua funcionando para o produto principal.
A aprovação é feita no painel Admin e o botão de WhatsApp pode ser usado para avisar o cliente.

O pagamento das atualizações foi preparado para Stripe. O fluxo PIX específico das atualizações pode ser ativado posteriormente caso você queira usar um QR PIX dinâmico de R$ 4,90.

NÃO ENVIE PARA O GITHUB:
- .env
- senhas
- DATABASE_URL
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- ACCESS_TOKEN_SECRET
- ADMIN_SESSION_SECRET

TESTE RECOMENDADO

1. Cadastre uma atualização de teste.
2. Faça uma compra de teste no Stripe.
3. Confirme o pagamento.
4. Entre em /minha-compra.html com o mesmo e-mail e WhatsApp.
5. Confira se a atualização aparece como COMPRADA.
6. Clique em "Acessar no MEGA".
