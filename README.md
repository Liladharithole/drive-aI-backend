# Enterprise Multi-Database AI SaaS Platform 🚀

A high-performance **NestJS 11** backend with **Prisma ORM (v7)** configured for a **decoupled multi-database architecture**: a Central Identity & Licensing server (`central-core-db`) and a Product database (`p-1-db`).

This repository hosts the **AI-Powered Google Drive SaaS (`DRIVE_AI`)** featuring multi-provider social authentication (Google & Apple OAuth), Dynamic RBAC, Product Entitlement guards, Google Drive folder trees, and S3 / local multipart file uploads.

---

## 📚 Project Documentation (`/docs`)

All comprehensive documentation and developer guides are located in the [**`/docs`**](./docs/) directory:

- 🚀 [**Developer Setup Guide**](./docs/SETUP_GUIDE.md): Clone, `.env` config, Prisma commands, and server startup.
- 🏛️ [**System Architecture**](./docs/ARCHITECTURE.md): Multi-database schemas, Dynamic RBAC, Entitlements, and Storage Drivers.
- 📡 [**API Documentation**](./docs/API_DOCUMENTATION.md): Full reference for all 27 API endpoints (`/auth`, `/admin`, `/products`, `/folders`, `/files`).

---

## 🌟 Key Features

- **Multi-Database Architecture**: Independent `central-core-db` and `p-1-db` linked logically via `userUuid`.
- **Multi-Provider Auth**: Email/Password + **Google OAuth 2.0** + **Sign in with Apple** with automatic account linking.
- **Dynamic RBAC**: Create custom roles and permission matrices on the fly without backend code changes.
- **Product Entitlement Gating**: `@RequireProduct('DRIVE_AI')` and `ProductAccessGuard` block revoked users instantly.
- **Google Drive Folders**: Nested sub-folders, custom colors, starred items, and Trash Bin recycle/restore.
- **File Storage Suite**: Multipart file uploads, human-readable size formatting (`2.4 MB`), direct download streaming, and pluggable Local/S3 storage drivers.

---

## 🛠️ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure .env with your MySQL credentials

# 3. Create databases & generate Prisma clients
npx prisma db push --config prisma.config.ts
npx prisma db push --config prisma-central-core.config.ts

# 4. Start NestJS dev server
npm run start:dev
```

- **Interactive Swagger Documentation**: `http://localhost:7001/api/docs`
