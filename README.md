# NestJS + Prisma starter (dual database)

A compact **[NestJS](https://nestjs.com/)** API template with **[Prisma 7](https://www.prisma.io/)** wired for **two MySQL-compatible databases**: a primary app database and a separate **central-core** schema with its own migrations folder.

**Stack:** NestJS 11 · Prisma 7 (`prisma/config`) · `@prisma/adapter-mariadb` · `nestjs-pino` / `pino-http`

---

## Contents

- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [CORS](#cors)
- [Migrations](#migrations)
- [Run the API](#run-the-api)
- [npm scripts](#npm-scripts)
- [Project layout](#project-layout)
- [Frontend (optional)](#frontend-optional)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | Current LTS (for example **20.x** or **22.x**) and **npm** |
| **MariaDB or MySQL** | URLs use `mysql://…`; Prisma provider is `mysql` |

---

## Quick start

### 1. Install

Clone this repo, enter the project root, then install dependencies:

```bash
cd nest-starter-with-prisma
npm install
```

`npm install` runs **`postinstall`**, which generates **both** Prisma clients:

| Database | Schema | Client package |
|----------|--------|----------------|
| Main app | `prisma/schema.prisma` | `@prisma/client` (default output) |
| Central-core | `prisma/schema.core-central.prisma` | `@prisma/client-central-core` (custom output in `node_modules`) |

If generation fails, fix `.env` (database URLs) and run:

```bash
npm run prebuild
```

(`prebuild` runs the same `prisma generate` commands as `postinstall`.)

### 2. Create databases

Create **two** databases whose names match your connection URLs, for example:

- `your_db` — main application  
- `your_central_core_db` — central-core  

```sql
CREATE DATABASE your_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE your_central_core_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Configure `.env`

Copy your team `.env` or create one in the **project root**. The app loads it via `dotenv` in `src/main.ts` and in the Prisma config files. Do **not** commit secrets; `.env` should stay git-ignored.

See [Environment variables](#environment-variables) for the full list.

### 4. Migrate and run

```bash
npm run db:migrate
npm run db:migrate:central-core
npm run start:dev
```

You should see: `Server listening on http://localhost:<PORT>` (default port **7001**).

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default **7001** if unset) |
| `NODE_ENV` | e.g. `development` or `production` |
| `LOG_LEVEL` | Pino log level (e.g. `debug`, `info`) |
| `DATABASE_URL` | Main DB — write connection |
| `DATABASE_READ_URL` | Main DB — read connection (optional in dev; falls back to `DATABASE_URL`) |
| `CENTRAL_CORE_DATABASE_URL` | Central-core DB — write connection |
| `CENTRAL_CORE_DATABASE_READ_URL` | Central-core read (optional in dev; falls back to `CENTRAL_CORE_DATABASE_URL`) |
| `CORS_ORIGIN` | Allowed browser origins (comma-separated). See [CORS](#cors). |
| `CORS_MAX_AGE` | Optional. Seconds browsers may cache CORS **preflight** (`OPTIONS`) results (`Access-Control-Max-Age`). Default **600** if unset. |

**Local development example** (adjust user, password, host, and database names):

```env
PORT=7001
NODE_ENV=development
LOG_LEVEL=debug

# Frontend URL(s) for CORS — e.g. Next.js on port 3000
CORS_ORIGIN=http://localhost:3000

# Optional — preflight cache (seconds). Omit for default 600.
# CORS_MAX_AGE=600

DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/your_db"
DATABASE_READ_URL="mysql://USER:PASSWORD@localhost:3306/your_db"

CENTRAL_CORE_DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/your_central_core_db"
CENTRAL_CORE_DATABASE_READ_URL="mysql://USER:PASSWORD@localhost:3306/your_central_core_db"
```

---

## CORS

Configured in `src/main.ts`.

| Setting | Behavior |
|--------|-----------|
| **`CORS_ORIGIN`** | One origin or comma-separated list (spaces trimmed). If unset/empty, CORS is **off** and a startup **warning** is logged — browsers may block your frontend. |
| **`CORS_MAX_AGE`** | Passed as **`maxAge`** (seconds). Default **600** when unset. |
| **`credentials`** | `true` — cookies and `fetch(..., { credentials: 'include' })`. Origins must be explicit (not `*`). |
| **`methods`** | `GET`, `HEAD`, `PUT`, `PATCH`, `POST`, `DELETE`, `OPTIONS`. |

### `allowedHeaders` vs `exposedHeaders`

- **`allowedHeaders`** — Headers the browser may send after preflight. Listing a name does not force the client to send it.
- **`exposedHeaders`** — Response headers JavaScript may **read** on cross-origin responses. Do **not** expose secrets (for example avoid exposing `x-api-key` here).

**Current `allowedHeaders`:** `Content-Type`, `Authorization`, `x-request-id`, `x-api-key`, `x-user-id`, `x-tenant-id`, `x-user-role`.

**Current `exposedHeaders`:** `x-request-id`, `x-user-id`, `x-tenant-id`, `x-user-role`.

Other options: **`preflightContinue`** `false`, **`optionsSuccessStatus`** `204`.

Restart the API after changing **`CORS_ORIGIN`** or **`CORS_MAX_AGE`**.

---

## Migrations

Apply migrations whenever schemas change:

```bash
# Main application — prisma/schema.prisma → prisma/migrations
npm run db:migrate

# Central-core — prisma/schema.core-central.prisma → prisma/migrations-central-core
npm run db:migrate:central-core
```

On a fresh clone, run **both** once so local databases match the repo.

---

## Run the API

```bash
# Development with auto-reload (recommended)
npm run start:dev

# Single run (no watch)
npm run start

# Production build then run
npm run build
npm run start:prod
```

---

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Dev server with file watch |
| `npm run start:debug` | Dev server with Node inspector |
| `npm run build` | Compile Nest app (`prebuild` runs Prisma generate first) |
| `npm run db:migrate` | Migrate main DB |
| `npm run db:migrate:central-core` | Migrate central-core DB |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests |
| `npm run test:e2e` | E2E tests |
| `npm run test:cov` | Coverage |

---

## Project layout

| Path | Role |
|------|------|
| `src/` | NestJS application code |
| `src/prisma/` | Main Prisma module and MariaDB adapter wiring |
| `src/prisma-central-core/` | Central-core Prisma module |
| `prisma/schema.prisma` | Main schema |
| `prisma/schema.core-central.prisma` | Central-core schema |
| `prisma.config.ts` | Prisma 7 config — schema path, migrations path, datasource URL from env |
| `prisma-central-core.config.ts` | Same for central-core |
| `prisma/migrations/` | Main database migrations |
| `prisma/migrations-central-core/` | Central-core migrations |

Logging uses **nestjs-pino** / **pino-http** (pretty logs outside production). Requests can carry `x-request-id` for tracing.

---

## Frontend (optional)

If you use a separate frontend (for example a Next.js app such as **`fms-frontend`**): start this backend (`npm run start:dev`), run the frontend’s `npm install` / `npm run dev`, set **`CORS_ORIGIN`** to the frontend origin (e.g. `http://localhost:3000`), and point the UI at this API (e.g. `http://localhost:7001`) per your frontend config.

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| **Cannot connect to database** | MySQL/MariaDB running; databases exist; `DATABASE_URL` / `CENTRAL_CORE_DATABASE_URL` match credentials. |
| **Prisma client out of date** | After pulling schema changes: `npm run prebuild` or `npm install`. |
| **Port already in use** | Change `PORT` in `.env` or stop the conflicting process. |
| **Browser “blocked by CORS policy”** | Set **`CORS_ORIGIN`** to the exact origin (scheme + host + port). Use commas for multiple dev URLs (`localhost` vs `127.0.0.1`). Restart the API. |
| **Preflight / custom header blocked** | Add the header to **`allowedHeaders`** in `main.ts` and restart. Lower **`CORS_MAX_AGE`** in dev after CORS changes, or wait for cache / hard-refresh. |

---

## License

Private / UNLICENSED (see `package.json`).
