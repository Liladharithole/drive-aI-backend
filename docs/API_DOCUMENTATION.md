# 📡 Comprehensive API Reference (37 Endpoints)

All endpoints are documented interactively via Swagger UI at **`http://localhost:7001/api/docs`**.

---

## 🔑 1. Authentication & Profile (`/auth`)

| Method   | Endpoint                | Protection | Description                               |
| -------- | ----------------------- | ---------- | ----------------------------------------- |
| `POST`   | `/auth/signup`          | Public     | Register new user with email and password |
| `POST`   | `/auth/login`           | Public     | Authenticate user and issue 24h JWT token |
| `POST`   | `/auth/signin`          | Public     | Alias for `/auth/login`                   |
| `GET`    | `/auth/google`          | Public     | Redirect to Google OAuth 2.0 login        |
| `GET`    | `/auth/google/callback` | Public     | Google OAuth callback handler             |
| `GET`    | `/auth/apple`           | Public     | Redirect to Sign in with Apple ID         |
| `GET`    | `/auth/apple/callback`  | Public     | Apple OAuth callback handler              |
| `GET`    | `/auth/me`              | JWT        | Get authenticated user profile            |
| `PATCH`  | `/auth/me`              | JWT        | Update user profile details               |
| `DELETE` | `/auth/me`              | JWT        | Soft-delete authenticated user account    |

---

## 👑 2. Admin & Dynamic RBAC (`/admin`)

| Method  | Endpoint                    | Permission Required | Description                                    |
| ------- | --------------------------- | ------------------- | ---------------------------------------------- |
| `POST`  | `/admin/roles`              | `roles.manage`      | Create a custom role with assigned permissions |
| `GET`   | `/admin/roles`              | `roles.manage`      | List all system roles and permission matrices  |
| `GET`   | `/admin/permissions`        | `roles.manage`      | List all available system permissions          |
| `POST`  | `/admin/users/roles`        | `users.roles`       | Assign custom roles to a user                  |
| `GET`   | `/admin/users`              | `users.view`        | Paginated user list with role badges           |
| `PATCH` | `/admin/users/:uuid/status` | `users.block`       | Block, suspend, or reactivate user status      |
| `POST`  | `/admin/products`           | `products.create`   | Create a new SaaS product in central-core      |

---

## 🛡️ 3. Product Entitlements (`/products`)

| Method | Endpoint                 | Protection | Description                                      |
| ------ | ------------------------ | ---------- | ------------------------------------------------ |
| `GET`  | `/products`              | Public     | List available SaaS products                     |
| `GET`  | `/products/entitlements` | JWT        | Get current user's product access statuses       |
| `POST` | `/products/access`       | JWT        | Admin grant, suspend, or revoke user entitlement |

---

## 📂 4. Folder Management (`/folders`)

| Method   | Endpoint                 | Product Entitlement | Description                                     |
| -------- | ------------------------ | ------------------- | ----------------------------------------------- |
| `POST`   | `/folders`               | `DRIVE_AI`          | Create root or sub-folder with custom color     |
| `GET`    | `/folders`               | `DRIVE_AI`          | List directory folders (filter starred/trashed) |
| `GET`    | `/folders/:uuid`         | `DRIVE_AI`          | Get single folder details & child sub-folders   |
| `PATCH`  | `/folders/:uuid`         | `DRIVE_AI`          | Rename, recolor, star, or move folder           |
| `PATCH`  | `/folders/:uuid/trash`   | `DRIVE_AI`          | Move folder to Trash Bin                        |
| `PATCH`  | `/folders/:uuid/restore` | `DRIVE_AI`          | Restore folder from Trash Bin                   |
| `DELETE` | `/folders/:uuid`         | `DRIVE_AI`          | Permanently delete folder                       |

---

## 📄 5. File Storage & Uploads (`/files`)

| Method   | Endpoint                | Product Entitlement | Description                                             |
| -------- | ----------------------- | ------------------- | ------------------------------------------------------- |
| `POST`   | `/files/upload`         | `DRIVE_AI`          | Queue a file upload job (Asynchronous, returns 202)     |
| `POST`   | `/files/upload/bulk`    | `DRIVE_AI`          | Queue multiple file uploads (Asynchronous, returns 202) |
| `GET`    | `/files/jobs/:jobId`    | `DRIVE_AI`          | Check status of a background file upload job            |
| `GET`    | `/files`                | `DRIVE_AI`          | List files inside folder (filter starred/trashed)       |
| `GET`    | `/files/:uuid`          | `DRIVE_AI`          | Get file metadata & formatted size (`2.4 MB`)           |
| `GET`    | `/files/:uuid/download` | `DRIVE_AI`          | Download or stream physical file Attachment             |
| `PATCH`  | `/files/:uuid`          | `DRIVE_AI`          | Rename, star/unstar, or move file                       |
| `PATCH`  | `/files/:uuid/trash`    | `DRIVE_AI`          | Move file to Trash Bin                                  |
| `PATCH`  | `/files/:uuid/restore`  | `DRIVE_AI`          | Restore file from Trash Bin                             |
| `DELETE` | `/files/:uuid`          | `DRIVE_AI`          | Permanently delete file from storage & DB               |

---

## 🖥️ 6. Drive Dashboard & Analytics (`/drive`)

| Method | Endpoint                 | Product Entitlement | Description                                   |
| ------ | ------------------------ | ------------------- | --------------------------------------------- |
| `GET`  | `/drive/starred`         | `DRIVE_AI`          | Get unified list of starred folders and files |
| `GET`  | `/drive/recent`          | `DRIVE_AI`          | Get list of recently modified files (last 30) |
| `GET`  | `/drive/trash`           | `DRIVE_AI`          | Get unified list of trashed folders and files |
| `GET`  | `/drive/storage-summary` | `DRIVE_AI`          | Get storage summary used vs 15 GB limit       |

---

## 🤝 7. File Sharing & Collaboration (`/shares`)

| Method   | Endpoint                    | Protection | Description                                               |
| -------- | --------------------------- | ---------- | --------------------------------------------------------- |
| `POST`   | `/shares`                   | JWT        | Share folder or file with another user by email           |
| `GET`    | `/shares/shared-with-me`    | JWT        | List all folders/files shared with current user           |
| `DELETE` | `/shares/:uuid`             | JWT        | Revoke sharing access for a shared folder/file            |
| `POST`   | `/shares/public`            | JWT        | Generate public, password-protected expiring link         |
| `GET`    | `/shares/public/:accessKey` | Public     | Access or download shared item (supports password unlock) |

---

## 🕒 8. Activity Audit Logs (`/audit`)

| Method | Endpoint      | Protection | Description                                                                                                     |
| ------ | ------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/audit/logs` | JWT        | Paginated chronological activity log feed (`file_activity_logs`, `folder_activity_logs`, `share_activity_logs`) |

---

## 🧠 9. Multilingual AI Document Intelligence & RAG Suite (`/ai`)

| Method | Endpoint                           | Protection | Description                                                                               |
| ------ | ---------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `POST` | `/ai/files/:fileUuid/process`      | JWT        | Queue async text extraction, vector embedding, and summary generation                     |
| `GET`  | `/ai/jobs/:jobId`                  | JWT        | Check background status & progress of AI document processing job                          |
| `GET`  | `/ai/files/:fileUuid/summary`      | JWT        | Get 1-page executive summary, 5 key bullet takeaways, and auto-classification             |
| `POST` | `/ai/files/:fileUuid/ask`          | JWT        | Multilingual RAG Q&A (Supports **English, Hindi, Marathi, Telugu, Tamil, Kannada**)       |
| `POST` | `/ai/files/:fileUuid/ask-voice`    | JWT        | Voice Q&A & Speech-to-Text (STT) Q&A (Uploads `.mp3`, `.wav`, `.webm`, `.m4a` audio clip) |
| `GET`  | `/ai/files/:fileUuid/chat-history` | JWT        | Get Q&A conversation history for a document                                               |
