## Knowledge Hub API

NestJS REST API for users, articles, categories, comments, JWT authentication, refresh tokens and role-based authorization.

## What Is Implemented

- Modular NestJS architecture (`user`, `article`, `category`, `comment`, `auth`, `prisma`)
- JWT authentication: `signup`, `login`, `refresh`, `logout`
- RBAC guard with 3 roles: `admin`, `editor`, `viewer`
- Global route protection with explicit public routes
- Input validation via DTO + global `ValidationPipe`
- PostgreSQL + Prisma persistence
- Swagger docs at `/doc`

## Auth and Security

- Public endpoints (no access token):
  - `POST /auth/signup`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `GET /`
  - `GET /doc`
- `POST /auth/logout` requires `Authorization: Bearer <accessToken>` and body `{ "refreshToken": "<refresh>" }` to revoke the refresh token.
- All other routes require `Authorization: Bearer <accessToken>`
- Access token payload includes:
  - `userId`
  - `login`
  - `role`
- Logout invalidates refresh token (in-memory revoked token set)
- Auth rate limiting (per IP, sliding window) is always enabled for:
  - `POST /auth/signup`
  - `POST /auth/login`
  - In `NODE_ENV=production`: 3 signups / 5 logins per IP per minute. Outside production, limits are higher so local e2e (many test files signing up in a row) is not rejected with HTTP 429.

## Role Rules (RBAC)

- `admin`: full access to all resources
- `viewer`: read-only (`GET`)
- `editor`:
  - can create/update own articles and comments
  - cannot manage categories
  - cannot change other users
  - cannot change roles

## Tech Stack

- NestJS 10
- TypeScript
- Prisma ORM
- PostgreSQL 16
- Swagger / OpenAPI
- class-validator / class-transformer
- Docker / Docker Compose

## Environment Setup

Create `.env` from `.env.example` and set at minimum:

```env
PORT=4000
CRYPT_SALT=10

JWT_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=knowledge_hub
POSTGRES_PORT=5432
DATABASE_URL="postgresql://admin:password123@localhost:5432/knowledge_hub?schema=public&connection_limit=10"
```

## Local Run (without Docker app container)

1. Start Postgres:

```bash
docker compose up -d db
```

2. Install dependencies:

```bash
npm install
```

3. Prepare database:

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

4. Start API:

```bash
npm run start:dev
```

App URLs:

- API: http://localhost:4000
- Swagger: http://localhost:4000/doc

## Render Deploy Notes

- Runtime: Node `24.10.0` (pinned in `package.json` and `.nvmrc`)
- Build command: `npm ci && npx prisma generate && npm run build`
- Start command: `npx prisma migrate deploy && node dist/src/main.js`
- Required env on the Render **Web Service**:
  - `DATABASE_URL` must be a real Postgres URL (`postgresql://...`), never `localhost`
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CRYPT_SALT`

## Docker Full Stack

```bash
docker compose up --build
```

The `app` service overrides `DATABASE_URL` to use hostname **`db`** (the Postgres service on the Compose network). Your `.env` can keep `localhost` for local runs without Docker; `docker compose` still injects the correct URL for the container.

Optional Adminer:

```bash
docker compose --profile debug up
```

Adminer URL: http://localhost:8080

## Testing

Important: E2E tests in this project send HTTP requests to `localhost:4000`, so API must be running while tests execute.

For `npm run test:auth`, `test:refresh`, and `test:rbac`, the Jest process sets `JWT_SECRET` and `JWT_SECRET_REFRESH_KEY`. The **running API must use the same values** (in `.env` or the shell that starts `npm run start:dev`), otherwise login/refresh checks and tests that mint JWTs will fail.

The e2e fixture user `TEST_AUTH_LOGIN` is promoted to admin **when the API is not in `NODE_ENV=production`**, so Jest does not need to pass `TEST_MODE` into the server process for local runs. In production, that login behaves like a normal user unless you explicitly set `TEST_MODE=auth` on the server (e.g. CI).

Recommended commands for this branch:

```bash
npm run test:auth
npm run test:refresh
npm run test:rbac
```

Additional:

```bash
npm run lint
npm run build
npm run test
```

## Assignment 8A - Testing (Vitest)

Unit testing scope for this task is implemented with `Vitest` and `@nestjs/testing`.

Implemented coverage:

- Service unit tests (isolated with mocks):
  - `UserService`
  - `ArticleService`
  - `CategoryService`
  - `CommentService`
  - `AuthService`
- Guard unit tests:
  - `JwtAuthGuard`
  - `JwtRbacGuard`
  - `RolesGuard`
- Exception filter unit tests:
  - `HttpExceptionFilter`
- Pipe unit tests:
  - UUID parsing / invalid UUID handling
- DTO validation unit tests:
  - required fields
  - invalid enums/types
  - valid payloads

Testing principles used:

- Dependency isolation via mocks (`vi.fn`, `vi.mock`, `vi.spyOn`)
- No real DB calls in unit tests
- No real HTTP calls in unit tests
- Edge cases covered (invalid UUIDs, duplicate login, expired/invalid token, forbidden actions, not found resources)

Scripts:

```bash
npm run test
npm run test:unit
npm run test:coverage
```

Coverage thresholds are configured in `vitest.config.ts`:

- Lines: `>= 90%`
- Branches: `>= 85%`

## Assignment 8B - Logging & Error Handling

Production-ready logging and error handling are implemented in the Nest bootstrap and common layer.

Implemented:

- Nest-compatible custom logger with configurable level:
  - `LOG_LEVEL` (default `log`)
  - supported levels: `log`, `debug`, `warn`, `error`, `verbose`
- Environment-aware output format:
  - development: human-readable logs
  - production: JSON structured logs
- Request/response logging middleware:
  - request: `method`, `url`, `query`, `body`
  - response: `statusCode`, `responseTimeMs`
- Sensitive data redaction:
  - `password`, `token`, `authorization`, `oldPassword`, `newPassword` are logged as `[REDACTED]`
- Global exception handling filter:
  - logs errors with stack traces
  - maps known errors to proper HTTP status
  - fallback unknown error response:
    - `statusCode: 500`
    - `error: Internal Server Error`
    - `message: An unexpected error occurred`
- Custom error classes:
  - `NotFoundError` -> `404`
  - `ValidationError` -> `400`
  - `UnauthorizedError` -> `401`
  - `ForbiddenError` -> `403`
- Process-level handlers:
  - `uncaughtException` with graceful shutdown
  - `unhandledRejection` with graceful shutdown
- File logging with size-based rotation:
  - `LOG_MAX_FILE_SIZE` in KB (default `1024`)
  - `logs/app.log` rotates to `logs/app-<timestamp>.log`

Environment variables added:

```env
LOG_LEVEL=log
LOG_MAX_FILE_SIZE=1024
```

Quick verification examples:

```bash
# typecheck + lint + unit
npx tsc --noEmit
npm run lint
npm run test:unit

# e2e (API should be running on the same PORT)
PORT=4000 npm run test

# production structured logs
PORT=4011 NODE_ENV=production npm start

# error-only logs
PORT=4012 LOG_LEVEL=error npm start

# force frequent rotation
PORT=4010 LOG_MAX_FILE_SIZE=1 npm start
```

## Prisma Commands

```bash
npx prisma generate
npx prisma migrate dev
npx prisma migrate deploy
npx prisma db seed
npx prisma studio
```

## Data Integrity Rules

- User deletion:
  - user comments -> cascade delete
  - article `authorId` -> set `null`
- Article deletion:
  - related comments -> cascade delete
- Category deletion:
  - article `categoryId` -> set `null`

## Project Structure

```text
src/
  auth/
  user/
  article/
  category/
  comment/
  prisma/
test/
prisma/
README.md
```
