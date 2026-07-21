# 🏛️ System Architecture & Design Patterns

This document details the multi-database architecture, Dynamic RBAC, Product Entitlements, and Storage Drivers.

---

## 🗄️ Multi-Database Architecture

```
 ┌────────────────────────────────────────────────────────┐
 │                   CENTRAL CORE DB                      │
 │                   (central-core-db)                    │
 │                                                        │
 │  - users, user_profiles, user_oauth_accounts           │
 │  - products, user_product_access                       │
 │  - roles, permissions, role_permissions, user_role_links│
 └───────────────────────────┬────────────────────────────┘
                             │
                             │ Logical Reference via userUuid
                             │ (No Cross-Database SQL Foreign Keys)
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │                    PRODUCT DB                          │
 │                     (p-1-db)                           │
 │                                                        │
 │  - folders (Parent/Child self-referential hierarchy)   │
 │  - files (Metadata, storageKey, storageUrl)            │
 └────────────────────────────────────────────────────────┘
```

### Why Decouple Central Core & Product Databases?

1. **Zero Cross-Database Lock Contention**: The product database (`p-1-db`) operates completely independently from the central authentication server (`central-core-db`).
2. **Infinite Scalability**: Adding a second product (e.g. `LEGAL_AI`) only requires spinning up a new product database schema while pointing to the existing `central-core-db`.

---

## 👑 Dynamic Role-Based Access Control (Dynamic RBAC)

Instead of hardcoding fixed enum roles, roles and permissions are dynamic database entities:

- **`Role`**: `id`, `uuid`, `code` (e.g. `SUPER_ADMIN`, `SUPPORT_AGENT`), `name`, `isSystem`.
- **`Permission`**: `id`, `uuid`, `code` (e.g. `users.view`, `products.create`), `module`.
- **`RolePermission`**: Junction table mapping roles to permissions.
- **`UserRoleLink`**: Junction table assigning roles to users.

### Enforcing Permissions in NestJS:

Routes specify required permission codes via `@RequirePermissions('users.view')`. `PermissionsGuard` intercepts the request:

- If the user holds `SUPER_ADMIN`, access is automatically granted.
- If the user holds a custom role with that permission code, access is granted.
- Otherwise, NestJS throws `HTTP 403 Forbidden`.

---

## 🛡️ Product Entitlements (`ProductAccessGuard`)

- **`Product`**: Represents a SaaS offering (`code: "DRIVE_AI"`).
- **`UserProductAccess`**: Statuses (`ACTIVE`, `SUSPENDED`, `EXPIRED`, `REVOKED`).

Routes specify product access via `@RequireProduct('DRIVE_AI')`. `ProductAccessGuard` checks if the user has an `ACTIVE` subscription in `central-core-db`. If revoked by an admin, the user is blocked instantly.

---

## 📦 Storage Drivers (`StorageService`)

Physical storage uses a pluggable pattern controlled by `STORAGE_DRIVER` in `.env`:

1. **Local Storage (`STORAGE_DRIVER=local`)**:
   - Saves physical files to local disk under `./uploads/{userUuid}/`.
   - Uses non-blocking promises (`node:fs/promises`).
2. **Cloud Storage (`STORAGE_DRIVER=s3`)**:
   - Streams files directly to AWS S3, Cloudflare R2, or DigitalOcean Spaces via `@aws-sdk/client-s3`.
