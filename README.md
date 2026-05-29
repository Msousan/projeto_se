# Controle de Solicitações e Produções

MVP web responsivo para controlar solicitações de produtos por loja, gerar produções em rodízio entre operadores ativos e acompanhar a fila pelo celular.

## Estrutura

- `backend`: API REST em Node.js, Express, TypeScript, Prisma e SQLite.
- `frontend`: React, TypeScript, Vite e Tailwind CSS.
- `modelo_solicitacao_loja.xlsx`: arquivo original encontrado na pasta, preservado.

## Usuários de Teste

Todos usam a senha `123456`.

- Gestor: `gestor@empresa.com`
- Supervisora Loja 01: `supervisora1@empresa.com`
- Operador João: `joao@empresa.com`
- Operador Maria: `maria@empresa.com`

## Backend

```bash
cd backend
copy .env.example .env
npm install
npm run migrate -- --name init
npm run seed
npm run dev
```

A API roda em `http://localhost:3333`.

Caso o Prisma retorne `Schema engine error` ao rodar migrations em Windows/SQLite, use a migration SQL já versionada:

```bash
cd backend
npx prisma db execute --file prisma/migrations/20260528210000_init/migration.sql --schema prisma/schema.prisma
npm run prisma:generate
npm run seed
```

## Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

A aplicação roda em `http://localhost:5173`.

Se quiser apontar para outra API, crie `frontend/.env`:

```env
VITE_API_URL=http://localhost:3333
```

## Fluxo Principal

1. Entre como supervisora ou gestor.
2. Crie uma solicitação com uma loja e de 1 a 100 produtos.
3. Entre como gestor e abra os detalhes da solicitação.
4. Clique em `Gerar produções`.
5. O sistema cria uma produção por item e distribui em rodízio entre operadores `ACTIVE`.
6. Entre como operador e acesse `Minha Fila`.
7. Inicie, pause, retome e finalize a produção.
8. Entre como gestor para acompanhar dashboard e lista de produções.

## Endpoints Implementados

- `POST /auth/login`
- `GET /auth/me`
- `GET /stores`
- `POST /stores`
- `PUT /stores/:id`
- `PATCH /stores/:id/deactivate`
- `GET /operators`
- `POST /operators`
- `PUT /operators/:id`
- `PATCH /operators/:id/status`
- `GET /products`
- `POST /products`
- `PUT /products/:id`
- `PATCH /products/:id/status`
- `GET /requests`
- `POST /requests`
- `GET /requests/:id`
- `PUT /requests/:id`
- `POST /requests/:id/generate-productions`
- `GET /productions`
- `GET /productions/my-queue`
- `GET /productions/:id`
- `POST /productions/:id/start`
- `POST /productions/:id/pause`
- `POST /productions/:id/resume`
- `POST /productions/:id/finish`
- `POST /productions/:id/cancel`
- `GET /dashboard/manager`

## Observações do MVP

- Autenticação usa JWT simples com expiração de 8 horas.
- Senhas são armazenadas com hash `bcrypt`.
- SQLite fica em `backend/prisma/dev.db`.
- A distribuição inicial de produções usa rodízio simples por operadores ativos ordenados por nome/id.
- Permissões são validadas no backend e as telas também são filtradas por perfil.
