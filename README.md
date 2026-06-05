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

Para aplicar migrations em ambiente ja publicado:

```bash
npm run prisma:deploy
```

Usuario administrador inicial do seed local:

- Nome: Administrador MD
- E-mail: admin@mdcomercioeservicos.com.br
- Senha: alterar123

## Inicializar producao na Vercel

Em producao, o banco da Vercel/Neon pode iniciar vazio. Siga esta ordem para preparar o banco e criar o primeiro administrador MD.

### 1. Configurar variaveis

No painel da Vercel, configure:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `APP_URL`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_SETUP_TOKEN`

Use uma senha forte em `ADMIN_PASSWORD` e um token longo/aleatorio em `ADMIN_SETUP_TOKEN`. As rotas temporarias nao retornam a senha, `DATABASE_URL` nem valores sensiveis.

### 2. Executar migrations pelo navegador

Depois do deploy, acesse:

```text
https://SEU-DOMINIO.vercel.app/setup-migrate
```

Informe `ADMIN_SETUP_TOKEN` e clique em `Executar migration`.

Essa pagina chama `POST /api/setup/migrate`, que executa `prisma migrate deploy` no banco configurado em `DATABASE_URL`.

Comportamento esperado:

- Token correto: aplica migrations pendentes e cria as tabelas do Prisma.
- Token incorreto: mostra erro de token invalido.
- Erro de migration: mostra mensagem resumida sem expor `DATABASE_URL` ou segredos.

Se o ambiente serverless da Vercel nao conseguir executar o Prisma CLI, use o fallback seguro em um terminal confiavel com as variaveis de producao configuradas:

```bash
npm install
npm run prisma:deploy
```

### 3. Criar administrador pelo navegador

Depois que as migrations passarem, acesse:

```text
https://SEU-DOMINIO.vercel.app/setup-admin
```

Informe `ADMIN_SETUP_TOKEN` e clique em `Criar administrador`.

Comportamento esperado:

- Token correto e nenhum `ADMIN_MD` ativo: cria o administrador com senha em hash bcrypt.
- `ADMIN_MD` ativo ja existente: informa que o administrador ja foi inicializado e nao cria outro usuario.
- Token incorreto: mostra erro de token invalido.
- Variaveis ausentes no servidor: mostra apenas os nomes das variaveis faltantes, sem exibir senha ou valores sensiveis.

### 4. Fazer login

Acesse a tela de login e entre com:

- E-mail: valor de `ADMIN_EMAIL`
- Senha: valor de `ADMIN_PASSWORD`

### 5. Remover acesso temporario

As paginas `/setup-migrate` e `/setup-admin` sao temporarias e podem ser removidas depois da inicializacao. Apos concluir o setup, remova ou rotacione `ADMIN_SETUP_TOKEN` nas variaveis da Vercel para reduzir a superficie de ataque.

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
