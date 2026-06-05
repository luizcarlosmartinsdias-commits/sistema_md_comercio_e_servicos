# Portal MD Comercio e Servicos

MVP do portal B2B da MD Comercio e Servicos para controle de assistencia tecnica de eletronicos, com foco inicial em celulares. O sistema separa clientes por empresa vinculada ao login, enquanto o administrador MD visualiza e opera todas as empresas e solicitacoes.

## Stack

- Next.js com App Router
- TypeScript
- Prisma
- PostgreSQL
- Tailwind CSS
- NextAuth com credenciais
- Hash de senha com bcrypt
- Tokens temporarios para convites e redefinicao de senha

## Como instalar

```bash
npm install
```

## Como configurar o ambiente

Copie `.env.example` para `.env` e preencha pelo menos:

```bash
DATABASE_URL="postgresql://usuario:senha@localhost:5432/md_portal?schema=public"
NEXTAUTH_SECRET="troque-por-um-segredo-forte"
APP_URL="http://localhost:3000"
ADMIN_NAME="Administrador MD"
ADMIN_EMAIL="admin@mdcomercioeservicos.com.br"
ADMIN_PASSWORD="troque-por-uma-senha-forte"
ADMIN_SETUP_TOKEN="troque-por-um-token-longo-aleatorio"
EMAIL_PROVIDER="mock"
WHATSAPP_PROVIDER="mock"
STORAGE_PROVIDER="local"
STORAGE_LOCAL_PATH="./uploads"
MD_NOTIFICATION_EMAIL="atendimento@mdcomercioeservicos.com.br"
MD_WHATSAPP_NUMBER="5521999999999"
```

## Migrations e seed local

```bash
npm run prisma:migrate
npm run prisma:seed
```

Usuario administrador inicial do seed local:

- Nome: Administrador MD
- E-mail: admin@mdcomercioeservicos.com.br
- Senha: alterar123

## Inicializar administrador na Vercel

Em producao, o banco da Vercel pode iniciar vazio. Para criar o primeiro administrador MD com seguranca, configure estas variaveis no painel da Vercel antes de chamar a rota de setup:

- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_SETUP_TOKEN`

Use uma senha forte em `ADMIN_PASSWORD` e um token longo/aleatorio em `ADMIN_SETUP_TOKEN`. A rota nao retorna a senha nem os valores sensiveis.

Depois do deploy, chame a rota uma unica vez:

```bash
curl -X POST "https://SEU-DOMINIO.vercel.app/api/setup/admin" \
  -H "Content-Type: application/json" \
  -d '{"token":"SEU_ADMIN_SETUP_TOKEN"}'
```

Tambem e possivel enviar o token pelo header `Authorization`:

```bash
curl -X POST "https://SEU-DOMINIO.vercel.app/api/setup/admin" \
  -H "Authorization: Bearer SEU_ADMIN_SETUP_TOKEN"
```

Comportamento esperado:

- Se o token estiver incorreto, a rota retorna `401`.
- Se faltar configuracao de ambiente, a rota retorna `500` indicando apenas os nomes das variaveis ausentes.
- Se ainda nao houver `ADMIN_MD` ativo, a rota cria o usuario com senha em hash bcrypt.
- Se ja existir um `ADMIN_MD` ativo, a rota retorna que o administrador ja foi inicializado e nao cria outro usuario.

Apos criar o administrador, remova ou rotacione `ADMIN_SETUP_TOKEN` nas variaveis da Vercel para reduzir a superficie de ataque.

## Como iniciar

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Observacoes sobre mocks

Na primeira versao, `NotificationService` registra e-mails, WhatsApp e notificacoes internas no banco e imprime detalhes no console quando os providers estao como `mock`. O `StorageService` usa armazenamento local em `STORAGE_LOCAL_PATH`, mantendo a interface pronta para bucket externo futuramente.

## Fluxo principal

1. Administrador MD cadastra empresas.
2. Administrador envia convites por e-mail.
3. Usuario cria senha pelo link de convite.
4. Cliente abre solicitacao sem escolher empresa; a empresa vem da sessao.
5. Administrador altera status e cria orcamento.
6. Cliente gestor aprova ou recusa.
7. Cliente envia O.S., solicita nota fiscal e baixa anexos.
8. MD anexa O.S. assinada e nota fiscal.
9. Historico de status, auditoria e notificacoes sao registrados.
