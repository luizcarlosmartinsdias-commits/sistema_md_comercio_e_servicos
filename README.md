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
- Envio de e-mail transacional com Resend ou mock local
- Geracao de PDF padronizado de orcamento com pdf-lib

## Perfis de usuario

O produto usa dois perfis funcionais:

- `ADMIN_MD`: administra empresas, clientes, convites, status operacionais, catalogo de servicos e orcamentos.
- `CLIENTE`: acessa apenas dados da propria empresa, abre solicitacoes, acompanha status, aprova/reprova orcamentos e solicita nota fiscal.

Por compatibilidade com o banco PostgreSQL atual, o enum Prisma ainda mantem os valores antigos `CLIENTE_SOLICITANTE`, `CLIENTE_GESTOR` e `CLIENTE_FINANCEIRO`. Todos eles sao tratados pelo codigo como `CLIENTE`. Novos convites de cliente sao gravados internamente com o valor compativel `CLIENTE_SOLICITANTE`, mas a interface mostra apenas `Cliente`.

## Como instalar

```bash
npm install
```

## Como configurar o ambiente

Copie `.env.example` para `.env` e preencha pelo menos:

```bash
DATABASE_URL="postgresql://usuario:senha@localhost:5432/md_portal?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="troque-por-um-segredo-forte"
APP_URL="http://localhost:3000"
ADMIN_NAME="Administrador MD"
ADMIN_EMAIL="admin@mdcomercioeservicos.com.br"
ADMIN_PASSWORD="troque-por-uma-senha-forte"
ADMIN_SETUP_TOKEN="troque-por-um-token-longo-aleatorio"
EMAIL_PROVIDER="mock"
RESEND_API_KEY=""
EMAIL_FROM=""
WHATSAPP_PROVIDER="mock"
STORAGE_PROVIDER="local"
STORAGE_LOCAL_PATH="./uploads"
MD_NOTIFICATION_EMAIL="atendimento@mdcomercioeservicos.com.br"
MD_WHATSAPP_NUMBER="5521999999999"
```

Em producao no dominio publicado, configure `NEXTAUTH_URL` e `APP_URL` com o mesmo dominio canonico:

```bash
NEXTAUTH_URL="https://mdcomercioeservicos.com.br"
APP_URL="https://mdcomercioeservicos.com.br"
```

Isso evita callbacks e cookies associados ao dominio errado da Vercel.

## Envio de e-mail

Por padrao, o sistema usa `EMAIL_PROVIDER=mock`. Nesse modo, o `NotificationService` apenas registra o envio em `NotificationLog` com status `MOCKED` e imprime uma linha simples no console.

Para enviar e-mails reais pelo Resend, configure na Vercel:

```bash
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_..."
EMAIL_FROM="MD Comercio e Servicos <noreply@mdcomercioeservicos.com.br>"
```

O remetente usado em `EMAIL_FROM` precisa estar autorizado no Resend. Verifique o dominio/remetente no painel do Resend antes de ativar em producao.

Com `EMAIL_PROVIDER=resend`, cada tentativa cria um `NotificationLog`:

- `SENT`: Resend aceitou o envio.
- `FAILED`: configuracao ausente ou falha retornada pelo Resend.

Falhas tambem aparecem nos logs da Vercel com contexto seguro: destinatario, assunto, protocolo relacionado quando existir e mensagem do erro. A chave `RESEND_API_KEY`, senha e corpo do e-mail nao sao impressos nos logs.

## Convites

O administrador envia convites pelo dashboard. A tela mostra feedback apos a submissao:

- `Convite enviado com sucesso para [email].`
- `Convite criado, mas houve falha no envio do e-mail.`
- `Nao foi possivel enviar o convite.`

A secao `Convites pendentes` lista nome, e-mail, perfil, empresa, expiracao, status e link copiavel enquanto o convite estiver pendente. Convites antigos criados antes desta versao podem aparecer como pendentes sem link copiavel, porque antes o sistema guardava apenas o hash do token.

Ao acessar `/invite/[token]`, o sistema mostra mensagens amigaveis para convite invalido, expirado ou ja aceito. Depois de criar a senha com sucesso, o usuario volta para `/login` com a mensagem `Cadastro criado com sucesso. Faça login.`

## Gestao de clientes

O dashboard administrativo mostra `Clientes cadastrados` com nome, e-mail, empresa, status, data de cadastro e a indicacao de ultimo acesso quando existir. Como o sistema ainda nao registra ultimo acesso, esse campo aparece como `nao registrado`.

Acoes disponiveis:

- Editar cliente.
- Inativar cliente.
- Reativar cliente.
- Excluir cliente quando nao houver historico.

Quando o cliente possui solicitacoes, historico, anexos ou auditoria, a exclusao fisica e substituida por inativacao para preservar os registros. Cliente inativo nao consegue logar e nao recebe novo convite; para voltar a usar o portal, o administrador deve reativar o cadastro.

## Servicos e orcamentos padronizados

O dashboard administrativo possui a secao `Servicos cadastrados`. Cada servico tem nome, descricao, categoria, valor padrao, status ativo/inativo, data de criacao e acoes para editar, inativar, reativar ou excluir quando ainda nao houver historico. Se o servico ja tiver sido usado em orcamento, a exclusao fisica e substituida por inativacao para preservar registros antigos.

O seed local cria servicos iniciais de referencia:

- Diagnostico tecnico
- Troca de componente
- Reparo de placa
- Troca de conector
- Instalacao eletrica
- Manutencao preventiva
- Configuracao de equipamento
- Mao de obra tecnica

Na tela da solicitacao, apenas `ADMIN_MD` pode criar orcamento. O administrador seleciona um ou mais servicos ativos, ajusta quantidade e valor unitario para aquele orcamento, informa desconto, validade, prazo de execucao, garantia, observacao e opcionalmente um anexo de apoio.

Ao criar o orcamento, o sistema:

- calcula subtotal, desconto e total;
- gera um PDF padronizado com identidade MD, dados da empresa MD, cliente, aparelho, problema, itens, valores e condicoes;
- salva o PDF como anexo `ORCAMENTO` vinculado a solicitacao e ao orcamento;
- envia o PDF por e-mail para todos os clientes ativos da empresa;
- registra `NotificationLog` com canal `EMAIL`, provider configurado e status `SENT`, `FAILED` ou `MOCKED`;
- registra no historico da solicitacao quando o orcamento foi criado e se o envio por e-mail passou ou falhou.

O assunto do e-mail e:

```text
Orcamento disponivel para aprovacao - [PROTOCOLO]
```

O corpo do e-mail contem protocolo, empresa, aparelho, valor total, link do portal para aprovacao/reprovacao e informacao de que o PDF esta anexado.

Qualquer `CLIENTE` ativo da empresa vinculada a solicitacao pode visualizar o PDF, ver os itens do orcamento, aprovar ou reprovar com observacao opcional. Clientes de outras empresas nao conseguem acessar a solicitacao nem os anexos.

### Armazenamento dos PDFs

O MVP continua usando `StorageService` com `STORAGE_PROVIDER=local`. Em ambiente serverless como Vercel, armazenamento local pode ser temporario entre invocacoes. Para producao com necessidade de manter downloads de PDFs e anexos por longo prazo, configure um storage persistente antes de considerar o fluxo definitivo. O envio por e-mail usa o PDF gerado em memoria no momento da criacao do orcamento.

## Migrations e seed local

```bash
npm run prisma:migrate
npm run prisma:seed
```

Para aplicar migrations em ambiente ja publicado:

```bash
npm run prisma:deploy
```

O comando `npm run build` executa `prisma migrate deploy` antes de `prisma generate` e `next build`. Na Vercel, isso aplica migrations pendentes no PostgreSQL configurado em `DATABASE_URL` antes do build da aplicacao.

Usuario administrador inicial do seed local:

- Nome: Administrador MD
- E-mail: admin@mdcomercioeservicos.com.br
- Senha: alterar123

## Inicializar producao na Vercel

Em producao, o banco da Vercel/Neon pode iniciar vazio. Siga esta ordem para preparar o banco e criar o primeiro administrador MD.

### 1. Configurar variaveis

No painel da Vercel, configure:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `APP_URL`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_SETUP_TOKEN`
- `EMAIL_PROVIDER`
- `RESEND_API_KEY`, quando `EMAIL_PROVIDER=resend`
- `EMAIL_FROM`, quando `EMAIL_PROVIDER=resend`

Para o dominio atual, use:

- `NEXTAUTH_URL=https://mdcomercioeservicos.com.br`
- `APP_URL=https://mdcomercioeservicos.com.br`

Use uma senha forte em `ADMIN_PASSWORD` e um token longo/aleatorio em `ADMIN_SETUP_TOKEN`. As rotas temporarias nao retornam a senha, `DATABASE_URL` nem valores sensiveis.

### 2. Executar migrations

A partir desta versao, o build de producao executa `prisma migrate deploy` automaticamente. Se precisar aplicar manualmente, use um terminal confiavel com as variaveis de producao configuradas:

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

Na primeira versao, `NotificationService` registra e-mails, WhatsApp e notificacoes internas no banco e imprime detalhes no console quando os providers estao como `mock`. O WhatsApp mock registra `NotificationLog` como `MOCKED` e imprime no log que o envio foi simulado. O `StorageService` usa armazenamento local em `STORAGE_LOCAL_PATH`, mantendo a interface pronta para bucket externo futuramente.

## Fluxo principal

1. Administrador MD cadastra empresas.
2. Administrador cadastra ou revisa servicos padronizados.
3. Administrador envia convites para clientes.
4. Cliente cria senha pelo link de convite.
5. Cliente abre solicitacao sem escolher empresa; a empresa vem da sessao.
6. Administrador altera status e cria orcamento a partir dos servicos cadastrados.
7. Sistema gera PDF, envia e-mail com anexo e registra historico/notificacoes.
8. Qualquer cliente ativo da empresa aprova ou reprova orcamento.
9. Cliente envia O.S., solicita nota fiscal e baixa anexos.
10. MD anexa O.S. assinada e nota fiscal.
11. Historico de status, auditoria e notificacoes sao registrados.
