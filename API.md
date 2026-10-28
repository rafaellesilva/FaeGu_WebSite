# API da Fa & Gu

## Rodando localmente

1. Copie `.env.example` para `.env` e troque `JWT_SECRET` e as credenciais administrativas.
2. Execute `npm install`.
3. Execute `npm run server`.

O banco local é criado automaticamente em `data/db.json` e não deve ser versionado.

## Autenticação

As sessões são mantidas em um cookie `httpOnly` chamado `fa_gu_session`.

- `POST /api/auth/register`: cria cliente. Body: `{ name, email, password }`.
- `POST /api/auth/login`: inicia sessão. Body: `{ email, password }`.
- `POST /api/auth/logout`: encerra sessão.
- `GET /api/auth/me`: retorna o usuário da sessão atual.

## Orçamentos

- `POST /api/quotes`: recebe um pedido público. Body: `name`, `email`, `message` e, opcionalmente, `phone`, `eventType`, `eventDate`, `guests`, `menuPackage`, `menuItems` e `estimate`.
- `GET /api/my/quotes`: lista os pedidos associados ao cliente autenticado.
- `GET /api/quotes`: lista todos os pedidos para administradores.
- `PATCH /api/quotes/:id`: atualiza o status para `new`, `contacted`, `scheduled` ou `closed`.

O administrador inicial é criado na primeira inicialização quando `ADMIN_EMAIL` e `ADMIN_PASSWORD` existem no ambiente.