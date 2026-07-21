# 🚀 Local Developer Setup Guide

This guide walks you through setting up the backend server, database schemas, and developer migration workflows from scratch.

---

## 📋 Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **MySQL Server**: Running on `localhost:3306`

---

## 🛠️ Step-by-Step Installation

### Step 1: Clone Repository & Install Dependencies

```bash
git clone <repository-url>
cd p-1
npm install
```

---

### Step 2: Configure Environment Variables (`.env`)

Create a `.env` file in the root directory:

```env
# Application Server Port
PORT=7001
NODE_ENV=development

# MySQL Databases
DATABASE_URL="mysql://root:password@localhost:3306/p-1-db"
CENTRAL_CORE_DATABASE_URL="mysql://root:password@localhost:3306/central-core-db"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="24h"

# File Storage Driver (Set to 'local' for FREE development)
STORAGE_DRIVER="local"

# Google OAuth 2.0 (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:7001/auth/google/callback"

# Sign in with Apple (Optional)
APPLE_CLIENT_ID="your-apple-client-id"
APPLE_TEAM_ID="your-apple-team-id"
APPLE_KEY_ID="your-apple-key-id"
APPLE_CALLBACK_URL="http://localhost:7001/auth/apple/callback"
```

---

### Step 3: Run Database Migrations & Generate Clients

Run the following **2 commands** to build both databases locally using our saved migration files:

#### 1. Setup Primary Database (`p-1-db`):

```bash
npx prisma migrate dev --config prisma.config.ts
```

_(Creates `folders` and `files` tables)_

#### 2. Setup Central Core Database (`central-core-db`):

```bash
npx prisma migrate dev --config prisma-central-core.config.ts
```

_(Creates `users`, `user_profiles`, `products`, `user_product_access`, `roles`, and `permissions` tables)_

---

### Step 4: Start the Server

```bash
npm run start:dev
```

When the server starts:

1. NestJS **automatically seeds** default products (`DRIVE_AI`), system permissions, and the `SUPER_ADMIN` role.
2. Interactive Swagger API documentation is running at **`http://localhost:7001/api/docs`**.

---

## 🔄 Team Workflow: Syncing Your Database

Whenever you pull the latest code updates from GitHub (`git pull`), another developer might have added new tables. Always run these **2 commands** to sync your local database:

```bash
# 1. Sync the Primary Database
npx prisma migrate dev --config prisma.config.ts

# 2. Sync the Central Core Database
npx prisma migrate dev --config prisma-central-core.config.ts
```

---

## 🛠️ Team Workflow: Creating New Database Changes

If you make database schema changes locally (e.g. adding a new table or column), run these commands to generate migration files before pushing to Git:

### A. If you updated `prisma/schema.prisma` (Primary DB):

```bash
npx prisma migrate dev --name <migration_description> --config prisma.config.ts
```

_Example:_ `npx prisma migrate dev --name add_sharing_links --config prisma.config.ts`

### B. If you updated `prisma/schema.core-central.prisma` (Central Core DB):

```bash
npx prisma migrate dev --name <migration_description> --config prisma-central-core.config.ts
```

_Example:_ `npx prisma migrate dev --name add_audit_logs --config prisma-central-core.config.ts`

---

## 🧪 Running Tests & Quality Checks

- **Run Unit Tests**: `npm test`
- **Run Type Check & Build**: `npm run build`
- **Run Linter**: `npm run lint`
