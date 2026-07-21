# 🤖 AI Agent Coding Guidelines & Project Rules

Welcome, Agent! This file outlines the architectural standards, code design principles, and strict rules for contributing code to this backend repository.

Read and adhere to these guidelines to ensure the project remains scalable, correct, and clean.

---

## 🏛️ 1. Core Architectural Rules

### A. Dual-Database Architecture

This project runs on two independent MySQL databases. **Never** mix their tables or attempt cross-database SQL joins.

1. **`central-core-db` (Identity & Licensing)**:
   - Config file: `prisma-central-core.config.ts`
   - Schema: `prisma/schema.core-central.prisma`
   - Manages: Users, Profiles, Social accounts, SaaS products, Entitlements, Roles, and Permissions.
2. **`p-1-db` (Product Data)**:
   - Config file: `prisma.config.ts`
   - Schema: `prisma/schema.prisma`
   - Manages: Folders and Files.

### B. Logical Cross-Database References

- Link product database records to identity database records using the user's UUID string (`userUuid`) **only**.
- Do **not** write raw SQL queries attempting to join tables between the two databases.

### C. Database Changes & Migrations

Always use Prisma Migrations to make database changes. Do **not** bypass them.

- **To sync changes locally**:
  ```bash
  npx prisma migrate dev --config prisma.config.ts                  # Primary DB
  npx prisma migrate dev --config prisma-central-core.config.ts     # Central Core DB
  ```
- **To deploy migrations to Staging/Production**:
  ```bash
  npx prisma migrate deploy --config prisma.config.ts
  npx prisma migrate deploy --config prisma-central-core.config.ts
  ```

---

## 📐 2. Core Code Design Principles

### A. DRY (Don't Repeat Yourself)

- Extract common helper functions into shared utilities (e.g. `src/common/utils/`).
- Reuse NestJS Guards (`JwtAuthGuard`, `ProductAccessGuard`, `PermissionsGuard`) instead of repeating auth or subscription validation blocks in controllers.

### B. SOLID Principles

1. **Single Responsibility Principle (SRP)**:
   - Keep controllers thin (handling HTTP requests/responses only).
   - Keep services focused on business logic.
   - Separate physical storage IO (`StorageService`) from metadata management (`FilesService`).
2. **Open/Closed Principle (OCP)**:
   - Code should be open for extension but closed for modification.
   - E.g., the `StorageService` can easily be extended with new drivers (like S3 or GCP) by adding configuration, without modifying `FilesService` core logic.
3. **Dependency Injection (DI)**:
   - Always let NestJS handle instantiation.
   - **Never** instantiate services using `new ServiceName()`. Always inject them via class constructors.

---

## 🔢 3. Prisma BigInt Serialization Rule

- Database IDs in this project are defined as `@db.UnsignedBigInt` (mapped to JS `bigint`).
- **CRITICAL**: Javascript JSON stringify does **not** natively support `BigInt` serialization and will crash!
- **Rule**: Always convert `BigInt` IDs to `string` in your DTOs or format helper mapping functions before returning responses to the client (e.g. `id: folder.id.toString()`).

---

## 🧪 4. Testing, Code Quality & Linter

- **Strict Types**: Always write explicit Typescript types. Avoid using `any` unless absolutely necessary (e.g. when mapping raw external callbacks). Cast safely using `instanceof` or TS assertions.
- **Write Unit Tests**: Whenever you create a new service or refactor logic, you must update or add corresponding Jest unit tests (e.g., `*.spec.ts`).
- **Validation Commands**:
  - Run build validation: `npm run build`
  - Run unit test suite: `npm test`
  - Run ESLint code checks: `npm run lint`
- All three checks must pass with **100% success** (0 errors) before pushing any code to GitHub.
