# API da Fa & Gu

## Rodando localmente

1. Copie `.env.example` para `.env` e preencha `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
2. Execute `npm install`.
3. Em um terminal, `npm start` (API em http://localhost:3000).
4. Em outro terminal, `npm run dev` e abra http://localhost:5173 (o Vite repassa `/api` para a API).

O banco SQLite é criado automaticamente em `data/site.db` (ou no caminho de `DATABASE_FILE`) e não deve ser versionado.
Se `BACKUP_BUCKET` estiver configurado, o banco é copiado para o S3 a cada `BACKUP_INTERVAL_MINUTES` (quando houve mudança)
e ao desligar, e é restaurado de lá automaticamente se o servidor subir sem o arquivo do banco.

Deploy na AWS: veja [DEPLOY-AWS.md](DEPLOY-AWS.md).

## Autenticação

As sessões são mantidas em um cookie de sessão `httpOnly` chamado `fa_gu_session`, descartado quando o navegador é fechado
(o token expira em 7 dias de qualquer forma). O site também encerra a sessão na primeira página de cada aba nova, então
fechar a aba e abrir o site de novo pede login. Login e cadastro aceitam até 10 tentativas a cada 15 minutos por IP.

- `POST /api/auth/register`: cria cliente. Body: `{ name, email, password }`.
- `POST /api/auth/login`: inicia sessão. Body: `{ email, password }`.
- `POST /api/auth/logout`: encerra sessão.
- `GET /api/auth/me`: retorna o usuário da sessão atual.

## Orçamentos

- `POST /api/quotes`: recebe a simulação de um cliente autenticado (até 20 por hora por IP); sem sessão retorna `401`. O pedido fica ligado ao cliente.
  Body: `message` e, opcionalmente, `name` e `email` (padrão: os da conta), `phone`, `eventType`, `eventDate`, `guests`, `menuPackage`, `menuItems` e `estimate`.
- `GET /api/my/quotes`: lista os pedidos associados ao cliente autenticado.
- `GET /api/quotes`: lista todos os pedidos (admin).
- `PATCH /api/quotes/:id`: atualiza o status para `new`, `contacted`, `scheduled` ou `closed` (admin).

## Administração

- `GET /api/admin/users`: lista usuários com a quantidade de orçamentos de cada um.
- `DELETE /api/admin/users/:id`: exclui a conta de um cliente (administradores não podem ser excluídos por aqui).
  Os orçamentos dele continuam no banco, só deixam de estar ligados a uma conta (`userId` fica vazio).
- `GET /api/admin/export/quotes.csv` e `GET /api/admin/export/users.csv`: planilhas (separador `;`, abrem direto no Excel).
- `GET /api/admin/export/quotes/:id.csv`: o mesmo formato da exportação de orçamentos, só com um pedido.
- `GET /api/admin/backup`: baixa uma cópia completa do banco (abre no DB Browser for SQLite). Contém hashes de senha.

## Administradores

O primeiro administrador é criado na inicialização quando `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo 12 caracteres) existem
no ambiente e o e-mail ainda não está cadastrado. Um e-mail já cadastrado como cliente nunca é promovido automaticamente.

Para os demais casos, use o script (no servidor da AWS, com `sudo`, dentro de `/var/app/current`):

```
node scripts/admin.js listar
node scripts/admin.js criar <email> [nome]
node scripts/admin.js promover <email>
node scripts/admin.js remover-admin <email>
node scripts/admin.js senha <email>
```
