# Auth Service — NestJS · TypeORM · PostgreSQL · Redis

A standalone, reusable authentication microservice. It is meant to be cloned once and dropped
in front of every other backend/full-stack project in your portfolio, so each of those projects
can focus on its own domain instead of reimplementing auth.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | NestJS 10 (TypeScript) |
| Database | PostgreSQL 16 + TypeORM (migrations, no `synchronize` in prod) |
| Cache / token blacklist | Redis 7 (`ioredis`) |
| Access tokens | JWT, **RS256** (asymmetric RSA-2048), 15 min TTL |
| Refresh tokens | Opaque random tokens, rotated, hashed (SHA-256) at rest |
| Password hashing | **Argon2id** |
| Validation | `class-validator` / `class-transformer` |
| Docs | Swagger/OpenAPI at `/api/docs` |
| Authorization | Advanced RBAC — DB-backed roles & permissions (many-to-many), enforced via `@Permissions()` |
| Rate limiting | `@nestjs/throttler` (5 req/min on `/auth/login`) |
| Tests | Jest (unit) + Supertest (e2e) |
| Optional | AWS Cognito as a second, swappable identity provider |

---

## Why RS256 (and Argon2id) — the algorithm question

**JWT signing: RS256, not HS256.**
HS256 uses one shared secret to both sign and verify — every service that needs to verify a
token needs the *same secret that can also forge tokens*. RS256 is asymmetric: this service
holds a **private key** and signs with it; every other service (your React/Next apps, your
other NestJS APIs) only needs the **public key** to verify tokens locally, with no network
call back to this service and no risk of leaking a forging-capable secret into five different
repos. It's also what AWS Cognito issues by default, so the optional Cognito module reuses the
exact same verification shape.

*If you want something newer:* **ES256** (ECDSA P-256) is the more modern alternative — smaller
tokens, faster signing — and increasingly recommended over RS256. RS256 was chosen here instead
because it has the widest library/tooling support (including every AWS SDK and most API
gateways), which matters more for a portfolio piece other projects will depend on. Swapping to
ES256 later only touches `TokenService` and the key-generation script.

**Refresh tokens: opaque, not JWTs.** They're random 96-character hex strings, stored server-side
only as a SHA-256 hash, with **rotation + reuse detection**: every refresh call revokes the old
token and issues a new one in the same "family"; if a *revoked* token is ever presented again,
the entire family is revoked and the user is forced to log in again — the standard defence
against a stolen refresh token being replayed.

**Passwords: Argon2id**, winner of the 2015 Password Hashing Competition, memory-hard and more
resistant to GPU/ASIC cracking than bcrypt. (If you deploy to a serverless platform that
struggles with argon2's native bindings, swap in `bcrypt` — the only place that changes is
`AuthService`.)

---

## Project structure

```
src/
  main.ts                     bootstrap: helmet, compression, CORS, Swagger, global pipes
  app.module.ts                wires everything, registers global guards
  config/                      typed config loader + Joi env validation
  common/                      decorators (@Public, @Roles, @Permissions, @CurrentUser), exception filter
  database/
    data-source.ts             TypeORM CLI connection (migrations only)
    migrations/                versioned SQL migrations (incl. RBAC tables)
    seeds/                     demo admin user seeder (assigns the "admin" role)
  modules/
    users/                     User entity, service, controller
    auth/                      AuthService, TokenService, strategies, guards, DTOs
    rbac/                      Role/Permission entities, RolesService, PermissionsService,
                                admin-only /roles endpoints, PermissionsGuard
    redis/                     token blacklist + user cache
    cognito/                   optional AWS Cognito provider (disabled by default)
test/                          e2e (Supertest) covering the full register→login→refresh flow
postman/                       ready-to-import collection + environment
keys/                          RS256 key pair (generated locally, gitignored)
```

---

## Prerequisites

- Node.js ≥ 18
- Docker + Docker Compose (for Postgres/Redis — or point `.env` at your own instances)
- OpenSSL (ships with macOS/Linux; on Windows use Git Bash or WSL)

## Quick start — exact commands

```bash
git clone <your-repo-url> auth-service
cd auth-service

npm install

cp .env.example .env
# edit .env if you're not using the default docker-compose values

npm run keys:generate          # creates keys/private.pem + keys/public.pem (RS256)

# Before this command you need to create a ew postgres database with the name of "auth_service".
npm run db:setup               # ONE COMMAND: starts Postgres+Redis via Docker,
                                # waits for Postgres, runs all migrations, creates every table

npm run db:seed                # optional: creates admin@example.com / ChangeMe123! with the "admin" role

npm run start:dev              # http://localhost:3000/api/v1
                                # Swagger:  http://localhost:3000/api/docs
```

That's it — `npm run db:setup` is the single command that spins up the database and creates
every table (`users`, `refresh_tokens`, `auth_tokens`) via `src/database/migrations/`.

### All available commands

| Command | What it does |
|---|---|
| `npm run start:dev` | Run with hot reload (`tsc` watch) |
| `npm run start:dev:hmr` | Run with full Webpack HMR (`webpack-hmr.config.js`) |
| `npm run build` / `start:prod` | Compile to `dist/` and run the compiled app |
| `npm run lint` | ESLint (auto-fix) |
| `npm run format` | Prettier |
| `npm test` | Unit tests (Jest) |
| `npm run test:cov` | Unit tests with coverage report |
| `npm run test:e2e` | End-to-end tests (needs a running DB — `npm run db:setup` first) |
| `npm run db:up` | Start only the Postgres/Redis containers |
| `npm run db:wait` | Block until Postgres accepts connections |
| `npm run db:setup` | `db:up` + `db:wait` + run all migrations |
| `npm run db:seed` | Insert a demo admin user |
| `npm run migration:generate -- src/database/migrations/SomeName` | Auto-generate a migration from entity changes |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Roll back the last migration |
| `npm run keys:generate` | Generate the RS256 key pair |

---

## Environment variables

See `.env.example` for the full, commented list. The important ones:

| Variable | Purpose |
|---|---|
| `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` | RSA key pair used to sign/verify access tokens |
| `JWT_ACCESS_TOKEN_TTL` | Access token lifetime in seconds (default 900 = 15 min) |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh token lifetime (default 7 days) |
| `DB_*` | PostgreSQL connection |
| `REDIS_*` | Redis connection (blacklist + cache) |
| `THROTTLE_LIMIT` / `THROTTLE_TTL` | Global rate limit; `/auth/login` overrides to 5/min |
| `AUTH_PROVIDER` | `local` (default) or `cognito` — informational flag for consumers of this API |
| `COGNITO_ENABLED` + `COGNITO_*` | Only needed if you turn on the optional Cognito module |

Startup validates all of this with a Joi schema (`src/config/validation.schema.ts`) — the app
refuses to boot with a missing/invalid `.env` instead of failing confusingly at request time.

---

## API endpoints

All routes are versioned under `/api/v1`. Full interactive docs (with request/response
schemas) are generated automatically at **`/api/docs`**.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create account, returns token pair |
| POST | `/auth/login` | Public | Email+password login |
| POST | `/auth/refresh` | Public | Rotate refresh token → new pair |
| POST | `/auth/logout` | Bearer | Revoke one session |
| POST | `/auth/logout-all` | Bearer | Revoke every session for the user |
| POST | `/auth/forgot-password` | Public | Issue a password-reset token |
| POST | `/auth/reset-password` | Public | Consume the token, set new password |
| GET | `/users/me` | Bearer | Current user profile |
| PATCH | `/users/me` | Bearer | Update profile |
| GET | `/users` | Bearer + `users:read` | List all users |
| PATCH | `/users/:id/roles` | Bearer + `users:manage-roles` | Replace a user's role assignments |
| GET | `/roles` | Bearer + `roles:read` | List all roles with their permissions |
| POST | `/roles` | Bearer + `roles:manage` | Create a role |
| PUT | `/roles/:id/permissions` | Bearer + `roles:manage` | Replace a role's permission set |
| DELETE | `/roles/:id` | Bearer + `roles:manage` | Delete a role |
| GET | `/roles/permissions/all` | Bearer + `roles:read` | List every permission |
| POST | `/roles/permissions` | Bearer + `roles:manage` | Create a permission |
| POST/GET | `/auth/cognito/*` | — | Optional AWS Cognito provider (see below) |

Every route requires a valid access token **by default** (global `JwtAuthGuard`); routes are
opted out explicitly with `@Public()`.

---

## RBAC model

Authorization is fully DB-backed, not just a `roles` string on the user:

```
User ──(user_roles)──< Role ──(role_permissions)──< Permission
```

- **`Role`** — a named bundle of permissions (`admin`, `user`, or any custom role you create).
- **`Permission`** — a single grantable action, named `"<resource>:<action>"` (e.g. `users:read`).
- A user's **effective permissions** are the union of every permission across all of their roles.
- On login/register, both the user's role names *and* their flattened, deduplicated permission
  list are baked into the JWT access token — so authorization checks on every request are a
  Set lookup against the token payload, with **no extra DB round-trip**.

Two guards are available, both registered globally:

| Decorator | Guard | Use for |
|---|---|---|
| `@Roles('admin')` | `RolesGuard` | Simple, coarse checks by role name |
| `@Permissions('users:read')` | `PermissionsGuard` | Fine-grained checks — **preferred for new endpoints** |

Because permissions live on roles (not hardcoded in guards), you can regrant what `admin` means
— or add a new `moderator` role with a custom permission set — entirely through the `/roles` API,
with no code changes or redeploy.

**Managing roles/permissions via the API** (all require the caller to already hold `roles:manage`
/ `users:manage-roles`, i.e. an admin account):

```bash
# Create a new role
POST /api/v1/roles
{ "name": "editor", "description": "Can edit content" }

# Grant it permissions (full replacement of the role's permission set)
PUT /api/v1/roles/<role-id>/permissions
{ "permissions": ["users:read"] }

# Assign that role to a user (full replacement of the user's roles)
PATCH /api/v1/users/<user-id>/roles
{ "roles": ["editor", "user"] }
```

**Important:** since roles/permissions are baked into the access token at login time, a user's
token stays stale after their roles change — **they must log in again** (or refresh) to pick up
new permissions.

---

## Testing

```bash
npm test              # unit tests: AuthService, TokenService, UsersService, RolesService,
                       # PermissionsService, RolesController
npm run test:cov       # with coverage
npm run db:setup && npm run test:e2e   # full HTTP flow against a real Postgres+Redis
```

Unit tests mock the repositories/Redis/JWT layer and specifically cover:
- password hashing on register, credential validation on login
- **refresh token rotation** and **reuse-detection** (the security-critical path)
- expired-token rejection
- forgot/reset-password, including the "don't leak whether an email exists" behaviour
- `@Exclude()`-based password hash stripping from API responses
- **RBAC**: role/permission CRUD, duplicate-name conflicts, rejecting unknown permission/role
  names when assigning, and the admin `/roles` controller delegating correctly to the services

## Postman

Import both files from `postman/`:
- `auth-service.postman_collection.json`
- `auth-service.postman_environment.json`

`Register`/`Login`/`Refresh` requests auto-save `accessToken`/`refreshToken` into the
environment via a test script, so the rest of the collection (including the admin-only and
Cognito requests) works without manual copy-pasting.

---

## Running with Docker

```bash
docker compose up -d postgres redis   # just the infra, run the API with `npm run start:dev`
# — or —
docker compose --profile full up -d --build   # infra + the built API container
```

The `Dockerfile` is a multi-stage build (small production image, no dev dependencies).

## Deploying

Works as-is on Railway, Render, or Fly.io (all offer managed Postgres + Redis add-ons):
1. Provision Postgres and Redis.
2. Set the `.env.example` variables as environment variables/secrets on the platform.
3. Store `keys/private.pem` and `keys/public.pem` as secret files (or base64 them into env vars
   and adjust `readKey()` in `src/config/configuration.ts` to decode from env instead of disk).
4. Run `npm run migration:run` once (most platforms let you run a one-off release command),
   then `npm run start:prod`.

---

## Reusing this service across your other portfolio projects

This is the whole point of building it as its own repo:

1. Deploy this service once (e.g. `auth.yourdomain.dev`).
2. Copy `keys/public.pem` into any other backend project that needs to verify tokens — it never
   needs the private key or a shared secret, just a `passport-jwt` strategy configured the same
   way as `src/modules/auth/strategies/jwt.strategy.ts` here (`algorithms: ['RS256']`,
   `secretOrKey: publicKey`).
3. Your React/Next frontends call `POST /auth/login` on this service, store the returned
   `accessToken`/`refreshToken`, and attach `Authorization: Bearer <accessToken>` to requests
   against *any* of your other APIs.
4. When the access token expires, call `POST /auth/refresh` here to get a new pair — no other
   service needs to know about refresh tokens at all.

---

## Optional: AWS Cognito provider

Everything above is the default, **local** provider (Postgres + Argon2id + RS256) and works
with zero AWS dependency. `src/modules/cognito/` adds a second, independent identity provider
you can point a project at instead, useful if an employer's stack standardizes on Cognito.

To enable it:
1. Create a Cognito User Pool + App Client (region `eu-central-1` by default — adjust for your
   target market).
2. Set `COGNITO_ENABLED=true`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`,
   `COGNITO_CLIENT_SECRET`, `AWS_REGION` in `.env`.
3. Configure AWS credentials for the process as usual (env vars, shared credentials file, or an
   IAM role if deployed on AWS).
4. Use the `/api/v1/auth/cognito/*` routes (register → confirm → login → the returned Cognito
   access token verifies via `GET /auth/cognito/me`).

The two providers are fully decoupled — enabling Cognito does not disable the local
Postgres/RS256 flow; they can run side by side.

---

## Security decisions summary

- Passwords hashed with **Argon2id**, never logged, excluded from all JSON responses
  (`class-transformer` `@Exclude()` + a global `ClassSerializerInterceptor`).
- Access tokens are short-lived (15 min) and **RS256**-signed; a leaked access token is
  worthless without the still-secret private key to forge new ones.
- Refresh tokens are **opaque**, stored only as a hash, **rotated on every use**, with
  **reuse-detection** that revokes the whole session family if a stolen token is replayed.
- Logout blacklists the current access token's `jti` in Redis with a TTL matching its
  remaining lifetime, so a token can be invalidated before it naturally expires.
- Global `ValidationPipe` with `whitelist`/`forbidNonWhitelisted` rejects unexpected payload
  fields outright.
- `helmet`, `compression`, explicit CORS origin, and a stricter rate limit on `/auth/login`
  (5 requests/min) to slow down credential stuffing.
- Env validated with Joi at boot — the app fails fast instead of misbehaving on bad config.

## License

MIT — use freely across your own portfolio projects.
