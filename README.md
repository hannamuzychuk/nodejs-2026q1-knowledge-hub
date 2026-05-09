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
- Start command: `npx prisma migrate deploy && node dist/main.js`
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

Important: E2E tests in this project send HTTP requests to `localhost:4000` (or `PORT` from `.env`), so the API must be running while tests execute.

For `npm run test:auth`, `test:refresh`, and `test:rbac`, the Jest process sets `JWT_SECRET` and `JWT_SECRET_REFRESH_KEY`. The **running API must use the same values** (in `.env` or in the shell that starts the server), otherwise login/refresh checks and tests that mint JWTs will fail.

**`TEST_MODE=auth` on the server:** `JwtRbacGuard` intentionally skips JWT checks in non-production when `TEST_MODE` is unset (legacy e2e convenience). The suites under `test/auth/*.e2e.spec.ts` expect **401 without a Bearer token**, so for `npm run test:auth` the API process must see `TEST_MODE=auth`. The easiest way is a dedicated dev server:

```bash
# Terminal A — same JWT vars as Jest + enforced auth
npm run start:dev:e2e

# Terminal B
npm run test:auth
```

The e2e fixture user `TEST_AUTH_LOGIN` is still promoted to admin when the API is not in `NODE_ENV=production` (see auth service); that is separate from the `TEST_MODE=auth` guard behavior above.

Recommended commands for this branch:

```bash
npm run start:dev:e2e   # terminal A, then:
npm run test:auth
npm run test:refresh
npm run test:rbac
```

**Live Gemini** (Jest + running API): `test/ai/articles-summarize.e2e.spec.ts`, `articles-translate`, and `articles-analyze` always call AI for a persisted article. Without `GEMINI_E2E`, the suite **passes** on either **200** (Gemini OK) or typical AI-layer errors (**500/503/502/429**) when the key is missing or the provider fails. Set **`GEMINI_E2E=1`** in the Jest terminal (e.g. `GEMINI_E2E=1 npm run test:auth`) to **require** HTTP **200** and full response-shape assertions—use this when the server has a working `GEMINI_API_KEY`.

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

## Assignment 9 - AI Integration (Gemini)

Gemini API is integrated in a dedicated `AiModule` with HTTP-based calls and DTO validation.

Implemented endpoints:

- `POST /ai/articles/:articleId/summarize`
- `POST /ai/articles/:articleId/translate`
- `POST /ai/articles/:articleId/analyze`
- `POST /ai/generate` (optional free-form generation)
- `GET /ai/usage` (in-memory usage snapshot since startup)

Request validation: global `ValidationPipe` in `main.ts` plus per-route DTOs (`ArticleIdParamDto` with `@IsUUID()`, summarize/translate/analyze/generate bodies). E2E checks for **400** (invalid param/body) and **404** (unknown article) live under `test/ai/*.e2e.spec.ts` (run with `npm run start:dev:e2e` + `npm run test:auth`).

Model:

- Default model: `gemini-2.0-flash` (configurable by `GEMINI_MODEL`)
- `GEMINI_API_KEY` is read at runtime from the environment (see `src/ai/gemini.service.ts`); Vitest covers missing key, default model URL, and custom `GEMINI_MODEL` / `GEMINI_API_BASE_URL` (`src/ai/gemini.service.unit.spec.ts`).

### How to get Gemini API key (step-by-step)

1. Open [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Go to **Get API key**.
4. Create a new API key in your project.
5. Copy the key value (visible once in UI).

### Setup after cloning

1. Create local env file:

```bash
cp .env.example .env
```

2. In `.env`, set required AI variables:

```env
GEMINI_API_KEY=your-real-key-here
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_MODEL=gemini-2.0-flash
AI_RATE_LIMIT_RPM=20
AI_CACHE_TTL_SEC=300
AI_SESSION_TTL_MS=1800000
AI_SESSION_MAX_TURNS=24
```

3. Run app:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

4. Open Swagger:

- [http://localhost:4000/doc](http://localhost:4000/doc) (use your `PORT` from `.env` if not `4000`)

### Swagger examples (`/doc`) — auth, article id, AI **200**

Use this flow for a **screenshot** (tag **ai** + successful **200**) or manual smoke tests. The server must have a valid **`GEMINI_API_KEY`** for AI routes to return **200**.

The **ai** routes in Swagger also show **sample values** (path `articleId`, JSON bodies) from `@ApiParam` / `@ApiProperty` `example` fields in the DTOs — replace `articleId` with a real id from **`GET /article`** before expecting **200**.

1. **`auth` → `POST /auth/signup`** — example request body:

```json
{
  "login": "swagger_demo_user",
  "password": "Secret12"
}
```

If login is already taken, use another unique `login` string or call **`POST /auth/login`** with the same credentials.

2. **`auth` → `POST /auth/login`** — same body as signup. Copy **`accessToken`** from the response.

3. Click **Authorize** (lock icon) at the top of Swagger → **Value**: `Bearer <paste_accessToken_here>` → **Authorize** → **Close**.

4. **`article` → `GET /article`** → **Execute**. From the JSON array, copy any object’s **`id`** (a UUID). That value is your `{articleId}`.

5. **`ai` → `POST /ai/articles/{articleId}/summarize`** — paste the UUID into `articleId`. Example body:

```json
{
  "maxLength": "medium"
}
```

**Execute** → expect **200** and fields such as `summary`, `articleId`, `originalLength`, `summaryLength`.

6. **`ai` → `POST /ai/articles/{articleId}/translate`** — same `articleId`. Example body:

```json
{
  "targetLanguage": "Polish"
}
```

Optional: `"sourceLanguage": "English"`.

7. **`ai` → `POST /ai/articles/{articleId}/analyze`** — same `articleId`. Example body:

```json
{
  "task": "review"
}
```

Allowed `task` values: `review`, `bugs`, `optimize`, `explain` (see DTO / Swagger enum).

8. **`ai` → `POST /ai/generate`** — example body:

```json
{
  "prompt": "Say hello in one short sentence.",
  "systemInstruction": "You are a concise assistant."
}
```

Follow-up in the same conversation — add **`sessionId`** copied from the **previous** `generate` response (must be a UUID):

```json
{
  "prompt": "What was my first message about?",
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

Replace `sessionId` with the **`sessionId`** returned by your previous **`POST /ai/generate`** call (the UUID above is only an example of the required format).

9. **`ai` → `GET /ai/usage`** — **Execute** with no body → **200** JSON with `totalRequests`, `requestsByEndpoint`, `observability`, etc.

### Example AI endpoint calls

Summarize:

```bash
curl -X POST "http://localhost:4000/ai/articles/<article-uuid>/summarize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"maxLength":"medium"}'
```

Translate:

```bash
curl -X POST "http://localhost:4000/ai/articles/<article-uuid>/translate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"targetLanguage":"Polish"}'
```

Analyze:

```bash
curl -X POST "http://localhost:4000/ai/articles/<article-uuid>/analyze" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"task":"review"}'
```

### Runtime behavior

- All `AiController` routes are protected by `AiRateLimitGuard` (`@UseGuards` on the controller in `src/ai/ai.controller.ts`).
- AI rate limit is per IP and configurable by `AI_RATE_LIMIT_RPM` (default `20`; non‑positive or non‑numeric values fall back to `20`, see `src/ai/ai-rate-limit.guard.ts` and unit tests).
- Limit response returns `429` and includes `Retry-After` header.
- Summarize/translate responses are cached in-memory with deterministic key:
  article id + request params + article `updatedAt`.
- Cache TTL is configurable by `AI_CACHE_TTL_SEC` (default `300`).
- Usage tracking is in-memory: **totals** (`totalRequests`, `totalTokens` when Gemini reports usage), **per-endpoint request counts** (`requestsByEndpoint`), and optional **per-endpoint token sums** (`tokensByEndpoint`).
- `GET /ai/usage` returns that snapshot plus **observability**: per-endpoint average Gemini latency (`geminiLatencyMsByEndpoint`), summarize/translate **cache hit ratios** and hit/miss counts, and **activeAiSessions** (in-memory conversation contexts).
- `POST /ai/generate` accepts optional `sessionId` (UUID returned from a previous generate call on this instance). The server keeps a short sliding window of prior user/model turns (TTL `AI_SESSION_TTL_MS`, max turns `AI_SESSION_MAX_TURNS`) and sends them to Gemini for multi-turn context.
- Structured model outputs (**translate** / **analyze** JSON, optional `{ "summary": "..." }` for summarize) are validated with **safe fallbacks** when parsing or schema fields fail.

### Gemini error handling

`GeminiService` maps provider and network failures to stable HTTP responses (no raw upstream stack traces):

- **Timeouts:** each request uses `AbortSignal` (~12s); aborts and common `TypeError` network failures become **503** with a short message (`AI service timeout or network error.`).
- **Auth / key issues:** HTTP **401** / **403**, or JSON `error.status` of `UNAUTHENTICATED` / `PERMISSION_DENIED` (including rare **200** bodies that only carry `error`), become **500** with `AI provider authentication failed.` — useful logs include the upstream message when present.
- **Rate limits:** HTTP **429** or `RESOURCE_EXHAUSTED` triggers **exponential backoff retries** (up to 3 attempts); if still limited, clients get **503** with `AI upstream is rate-limited. Please try again later.`
- **Upstream 5xx / 502:** mapped to **503** `AI upstream is temporarily unavailable.`
- **Invalid input (HTTP 400):** mapped to **400** `BadRequestException`, optionally with a truncated upstream `error.message`.

Unit coverage: `src/ai/gemini.service.unit.spec.ts` (timeout, network, 401/403, 429 + retry, exhausted 429, 5xx, 400, and error-in-JSON edge cases).

### Known limitations

- Free Gemini tier has quotas and may return upstream rate limits.
- Latency depends on current provider load and network.
- Regional availability may vary by Google account/project settings.
- AI cache and usage tracking reset on service restart (in-memory only).

## Assignment 10 - RAG & Vector Database (in progress)

RAG implementation for Knowledge Hub will be added in a dedicated `RagModule`.

Planned endpoints:

- `POST /ai/rag/index`
- `POST /ai/rag/search`
- `POST /ai/rag/chat`
- `DELETE /ai/rag/index/articles/:articleId`
- `GET /ai/rag/chat/:conversationId/history` (optional)

Planned stack:

- Gemini generation model: `gemini-2.0-flash`
- Gemini embedding model: `text-embedding-004`
- External vector database in Docker Compose (Qdrant)


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
