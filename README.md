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
EMAIL_PROVIDER="mock"
WHATSAPP_PROVIDER="mock"
STORAGE_PROVIDER="local"
STORAGE_LOCAL_PATH="./uploads"
MD_NOTIFICATION_EMAIL="atendimento@mdcomercioeservicos.com.br"
MD_WHATSAPP_NUMBER="5521999999999"
```

## Migrations e seed

```bash
npm run prisma:migrate
npm run prisma:seed
```

Usuario administrador inicial:

- Nome: Administrador MD
- E-mail: admin@mdcomercioeservicos.com.br
- Senha: alterar123

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
