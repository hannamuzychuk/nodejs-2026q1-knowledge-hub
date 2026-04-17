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

- Public endpoints:
  - `POST /auth/signup`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `GET /`
  - `GET /doc`
- All other routes require `Authorization: Bearer <accessToken>`
- Access token payload includes:
  - `userId`
  - `login`
  - `role`
- Logout invalidates refresh token (in-memory revoked token set)
- Auth rate limiting is enabled in `production` for:
  - `POST /auth/signup`
  - `POST /auth/login`

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

## Docker Full Stack

```bash
docker compose up --build
```

Optional Adminer:

```bash
docker compose --profile debug up
```

Adminer URL: http://localhost:8080

## Testing

Important: E2E tests in this project send HTTP requests to `localhost:4000`, so API must be running while tests execute.

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
