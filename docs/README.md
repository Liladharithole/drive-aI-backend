# Enterprise Multi-Database AI SaaS Platform 🚀

Welcome to the **Enterprise Multi-Database AI SaaS Platform** backend repository. This backend is built using **NestJS**, **TypeScript**, **MySQL**, **Prisma ORM**, and **Swagger API Documentation**.

The platform features a decoupled multi-database architecture and currently hosts an **AI-Powered Google Drive SaaS Application (`DRIVE_AI`)**.

---

## 📚 Documentation Sitemap

- [🚀 Quick Setup Guide](./SETUP_GUIDE.md) — How to clone, configure `.env`, run Prisma migrations, and start the app locally.
- [🏛️ System Architecture](./ARCHITECTURE.md) — Multi-database schema design, Dynamic RBAC, Product Entitlements, and Storage Drivers.
- [📡 API Documentation](./API_DOCUMENTATION.md) — Complete reference for all 27 API endpoints (`/auth`, `/admin`, `/products`, `/folders`, `/files`).

---

## 🌟 Key Features

1. **Multi-Database Architecture (`central-core-db` & `p-1-db`)**:
   - Decoupled Central Identity & Licensing server vs Product Database. Linked via string `userUuid` for zero cross-database SQL locks.
2. **Multi-Provider Authentication**:
   - Email/Password authentication.
   - **Google OAuth 2.0** & **Sign in with Apple ID** social authentication with automatic account linking.
3. **Dynamic Role-Based Access Control (Dynamic RBAC)**:
   - Create custom roles (`SUPER_ADMIN`, `ADMIN`, `SUPPORT_AGENT`, etc.) and assign granular permissions (`users.view`, `products.create`) dynamically without code changes.
4. **Product Entitlement & Feature Gating (`ProductAccessGuard`)**:
   - Protects SaaS routes (`@RequireProduct('DRIVE_AI')`). Automatically blocks revoked or suspended users with HTTP 403 Forbidden.
5. **Google Drive Folder Management**:
   - Self-referential infinite folder nesting (`parent` / `children`), custom hex colors, starred folders, Google Drive Trash Bin, and soft/hard deletes.
6. **File Storage & Upload Suite**:
   - Multipart file uploads (PDF, DOCX, PNG, CSV, TXT), human-readable size calculations (`2.4 MB`), duplicate name prevention, direct streaming downloads, and Google Drive Trash Bin for files.
7. **Pluggable Storage Driver**:
   - **Local Storage** (`STORAGE_DRIVER=local`) for 100% free local development.
   - **AWS S3 Cloud Storage** (`STORAGE_DRIVER=s3`) integration ready out of the box.

---

## 🛠️ Technology Stack

- **Framework**: NestJS (v11)
- **Language**: TypeScript
- **Databases**: MySQL (v8.0)
- **ORM**: Prisma (Dual Client Setup)
- **Authentication**: Passport.js, JWT, OAuth 2.0 (Google & Apple)
- **File Uploads**: Multer, `@aws-sdk/client-s3`
- **Documentation**: `@nestjs/swagger` (Swagger UI at `http://localhost:7001/api/docs`)
- **Logging**: `nestjs-pino`
