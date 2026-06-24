# Architecture Overview

This document explains the current architecture of the project, what has been implemented so far, and what should be improved for production readiness.

## 1) Project Summary

This is a NestJS backend organized by business modules with Prisma as ORM.

Main capabilities implemented:

- Multi-tenant domain model (`User`, `Tenant`, `UserTenant`, `Invitation`)
- Authentication with JWT stored in cookie
- Tenant registration and user login
- Tenant membership and invitation flows
- Password reset/update endpoints
- E2E coverage for user-facing endpoints

Core bootstrap is in [src/main.ts](src/main.ts).
Root module wiring is in [src/app.module.ts](src/app.module.ts).

## 2) High-Level Architecture

### Application Layer

- Framework: NestJS
- Global middleware/pipes:
  - `helmet`
  - `cookie-parser`
  - global `ValidationPipe`
  - CORS (currently fixed whitelist)
- API prefix: `/api/{API_VERSION}`

### Module Layer

Under [src/Modules](src/Modules):

- [src/Modules/users](src/Modules/users): auth, profile endpoints, invite actions
- [src/Modules/tenants](src/Modules/tenants): tenant CRUD logic
- [src/Modules/user-tenants](src/Modules/user-tenants): user↔tenant membership/roles
- [src/Modules/invitation](src/Modules/invitation): invitation storage and state

### Data Layer

- Prisma + SQLite (current runtime datasource in `.env`)
- Schema in [prisma/schema.prisma](prisma/schema.prisma)
- Database service in [src/app/database/database.service.ts](src/app/database/database.service.ts)

## 3) Domain Model

From [prisma/schema.prisma](prisma/schema.prisma):

- `User`
- `Tenant`
- `UserTenant` (membership + role)
- `Invitation` (token, expiry, status, tenant, role)

Enums:

- `Role`: `USER`, `TENANT_ADMIN`, `PLATFORM_ADMIN`
- `Status`: `PENDING`, `ACCEPTED`, `REJECTED`
- `Plan`: `FREE`, `PRO`, `ENTERPRISE`

## 4) API Surface (Current)

Main controller: [src/Modules/users/users.controller.ts](src/Modules/users/users.controller.ts)

Implemented endpoints include:

- `POST /api/{version}/tenant/register`
- `POST /api/{version}/auth/login`
- `GET /api/{version}/me/tenant`
- `GET /api/{version}/users` (tenant scoped behavior intended)
- `PUT /api/{version}/tenant/:tenantId/select`
- `POST /api/{version}/users/invite`
- `PUT /api/{version}/user/invitation/:token/confirm`
- `POST /api/{version}/auth/reset-password`
- `PUT /api/{version}/password/:token/update`
- `GET /api/{version}/auth/logout`

## 5) Security Model (Current)

- Password hashing via argon2 helpers in [src/Modules/users/users.type.ts](src/Modules/users/users.type.ts)
- JWT creation/verification in [src/Modules/users/middleware/check-user.service.ts](src/Modules/users/middleware/check-user.service.ts)
- Route protection via `UserAuthGuard`
- JWT strategy currently resolves user by `userId`

## 6) Testing State

- E2E tests are implemented in [test/app.e2e-spec.ts](test/app.e2e-spec.ts)
- They cover the primary user/auth/invite endpoints and currently pass

## 7) What Was Done Recently

Major additions and stabilization completed:

- Multi-tenant entities and relationship model
- Invite lifecycle endpoints and invitation persistence
- Auth flow and cookie-based session token
- Endpoint-level E2E test coverage for the user module
- `.gitignore` alignment for generated prisma and sqlite files

## 8) Gaps / Risks to Address Before Production

### A. Tenant context consistency

Current code has mixed tenant-context patterns:

- Some endpoints read tenant from authenticated user context
- Some use tenant from body/path

Production target:

- Enforce one active tenant context strategy consistently
- Prefer explicit active tenant in token OR explicit tenant header/path with server-side membership verification

### B. Switch-tenant behavior

`PUT /tenant/:tenantId/select` should issue a fresh auth token containing active tenant context and role, not only mutate/query data.

### C. Invitation flow semantics

Current invite flow marks invitation as `PENDING` confirmation endpoint succeeds it marks `ACCEPTED`.

### D. HTTP status correctness

Some business errors use non-ideal status codes (`FOUND`, etc.). Normalize:

- duplicate resource: `409`
- auth failure: `401`
- forbidden tenant access: `403`
- not found: `404`

### E. Validation/typing cleanup

- Remove temporary lint suppressions where possible
- Use strict DTO typing for all request/response contracts
- Add request typing for `req.user` payload shape

### F. Observability and operations

Missing production essentials:

- structured logging with request correlation ID
- health/readiness endpoints
- metrics (Prometheus/OpenTelemetry)
- centralized error handling and exception mapping

### G. Security hardening

- Move secrets from `.env` to secret manager in deployed env
- `httpOnly` cookies should be true in production
- set secure/sameSite/domain values by environment
- add brute-force/rate limiting on auth endpoints

### H. Data and migration strategy

There is currently an environment mismatch risk:

- app configured for SQLite in `.env`
- docker-compose also contains Postgres-oriented setup/comments

Production target:

- choose one datastore per environment
- define clear migration strategy (`prisma migrate deploy` in CI/CD)
- avoid `db push` outside local/dev

### I. Module composition

`UsersModule` currently provides several services from other modules directly. Prefer importing/exporting via module boundaries to avoid tight coupling.

## 9) Recommended Production Plan (Practical Sequence)

1. Stabilize tenant context contract
   - include `tenantId` and role in auth context
   - enforce tenant membership check on all protected tenant-scoped routes

2. Fix invitation state machine
   - `PENDING` on create
   - `ACCEPTED/REJECTED/EXPIRED` only through dedicated transitions

3. Normalize statuses and errors
   - business exceptions mapped to consistent HTTP responses

4. Harden auth + cookies
   - env-specific cookie policy
   - token rotation/expiry policy

5. Make infrastructure deterministic
   - decide SQLite-only (dev) vs Postgres (dev/prod)
   - finalize docker compose and startup scripts accordingly

6. Add production telemetry
   - logs, metrics, tracing, health checks

7. Expand tests
   - negative tests for authorization and tenant isolation
   - invitation edge cases (expired/duplicate/replay)

## 10) Runbook (Current)

Typical local flow:

- `npm install`
- `npm run db:push`
- `npm run start:dev`

E2E tests:

- `npm run test:e2e -- --runInBand`

Build:

- `npm run build`

---

If required, this architecture can be evolved next into a clean API-gateway + service split (Users/Tenants/Invitations) once tenant-context enforcement is fully consistent in the monolith.

For tes purpose i went with sqlite to easily boostrap the app and levrage the db for easy access but for production purpose and large project, i will choose to go with Mysql o postgreSQL all in docker container to facilitate work and project sharing.

I will also add a github workflow continious delivering through github action building and running test after every pull request before merging in prod.

For easy and fast viewing, i put all the endPoints in userController but for a large. prod api all modules has it's own controller and bussiness logic comming from services.

For user/invite, we could goas far as sending the token generated to the user via email redirecting on a page with a prior check if it's still valid then ask the user to confirm or decline the invitation. If invitation recieves no response from user, the tenant can send a new invitation if will.

If the user accepts the invitation, he/she is asked to enter fullname and Password. Ant with these, i create a user, userTenant and confirme the invitation in Invitation table. This is done because i took the case where the user is not yet authenticated in the app. In the perspective where the user was all ready in the app, the inivtation will been more faster.
