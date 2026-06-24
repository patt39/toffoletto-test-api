# Test Project API

Backend API built with NestJS + Prisma for a multi-tenant workflow (users, tenants, memberships, invitations).

## Tech stack

- NestJS (TypeScript)
- Prisma ORM
- SQLite (local development)
- JWT + cookie-based auth
- Jest / Supertest for tests

## Project structure

- `src/Modules/users` → auth, profile, invitations, password flows
- `src/Modules/tenants` → tenant logic
- `src/Modules/user-tenants` → user ↔ tenant membership + roles
- `src/Modules/invitation` → invitation persistence and status
- `prisma/schema.prisma` → data model

Architecture details: see [ARCHITECTURE.md](ARCHITECTURE.md).

## Prerequisites

- Node.js 22+
- npm 10+

## Local setup (recommended)

1. Install dependencies

```bash
npm install
```

1. Ensure environment exists

Use [.env](.env) with at least:

```dotenv
PORT=6000
API_VERSION=v1
DATABASE_URL="file:./sqlite/test-api.db"
```

1. Sync database schema

```bash
npm run db:push
```

1. Start API in watch mode

```bash
npm run start:dev
```

API base URL:

- <http://localhost:6000/api/v1>

## Build and run

Build:

```bash
npm run build
```

Run compiled app:

```bash
npm run start:prod
```

## Tests

Run unit tests:

```bash
npm run test
```

Run e2e tests:

```bash
npm run test:e2e
```

Run e2e sequentially:

```bash
npm run test:e2e -- --runInBand
```

## Main endpoints

- `POST /api/v1/tenant/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/me/tenant`
- `GET /api/v1/users`
- `PUT /api/v1/tenant/:tenantId/select`
- `POST /api/v1/users/invite`
- `PUT /api/v1/user/invitation/:token/confirm`
- `POST /api/v1/auth/reset-password`
- `PUT /api/v1/password/:token/update`
- `GET /api/v1/auth/logout`

## Notes for recruiters / reviewers

Quick start:

```bash
npm install
npm run db:push
npm run start:dev
```

Then hit:

- <http://localhost:6000/api/v1>

And run validation tests:

```bash
npm run test:e2e -- --runInBand
```
