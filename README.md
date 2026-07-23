# 🏛️ Drive AI Backend — System Architecture Specification

---

## 📑 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Decoupled Multi-Database Architecture](#2-decoupled-multi-database-architecture)
3. [Exhaustive Data Dictionary & Entity-Relationship Model](#3-exhaustive-data-dictionary--entity-relationship-model)
4. [System Architecture & Multimodal Processing Flow](#4-system-architecture--multimodal-processing-flow)
5. [Core Engine Specifications](#5-core-engine-specifications)
   - [5.1 Document Ingestion & Multimodal Processing Pipeline](#51-document-ingestion--multimodal-processing-pipeline)
   - [5.2 Vector Embedding & Grounded RAG Engine](#52-vector-embedding--grounded-rag-engine)
   - [5.3 One-Click Neural Document Translation & Export Engine](#53-one-click-neural-document-translation--export-engine)
   - [5.4 Real-Time Voice Dictation (STT) Engine](#54-real-time-voice-dictation-stt-engine)
   - [5.5 Database-Backed Conversational Session Manager](#55-database-backed-conversational-session-manager)
6. [Security, Authentication & Dynamic RBAC Engine](#6-security-authentication--dynamic-rbac-engine)
7. [Pluggable Storage Driver Abstraction](#7-pluggable-storage-driver-abstraction)
8. [Background Processing & Queue Architecture](#8-background-processing--queue-architecture)
9. [Exhaustive API Reference Manual](#9-exhaustive-api-reference-manual)
10. [Developer Setup & Operations Guide](#10-developer-setup--operations-guide)

---

## 1. Executive Summary

The **Drive AI SaaS Platform Backend** is an enterprise-grade, high-concurrency microservice application constructed on **NestJS 11**, **Prisma ORM (v7)**, **BullMQ**, and **Google Gemini AI**. The system presents a secure Google Drive workspace platform integrated with multimodal Artificial Intelligence capabilities:

- **Multimodal Document & Media Ingestion**: Automatic text extraction from plain text, PDF (with Gemini Vision OCR fallback), Microsoft Word (.docx), raster images (PNG, JPG, WEBP), audio files (MP3, WAV, M4A), and video streams (MP4, AVI, MOV).
- **Grounded Retrieval-Augmented Generation (RAG)**: In-memory Cosine Similarity vector search over 768-dimensional float arrays with citation backing and strict file-level context scoping.
- **One-Click Neural Translation & Document Packaging**: Translates full document contents into 13 target languages using Gemini and programmatically compiles exportable **PDF**, **DOCX**, and **TXT** files saved directly back to the user's workspace.
- **Decoupled Central Core Licensing Architecture**: Multi-database isolation separating Central Identity, Single Sign-On (SSO), Dynamic RBAC, and Product Entitlement from the local Product Database workspace.

---

### 1.1 Complete Backend Technology Stack Specification

| Category                    | Technology                         | Version                                     | Purpose in Platform Architecture             | Selection Rationale & Advantage                                                                                                                                        |
| :-------------------------- | :--------------------------------- | :------------------------------------------ | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework & Engine**      | **NestJS**                         | `^11.0.1`                                   | Application Gateway & Microservice Framework | Enforces strict modularity, Dependency Injection (DI), decorators, and standardized request lifecycle handling across controllers, services, guards, and interceptors. |
| **Language**                | **TypeScript**                     | `^5.7.3`                                    | Core Implementation Language                 | Eliminates dynamic typing bugs, guarantees compile-time type safety across DTOs and Prisma schemas, and enables autocomplete and refactoring.                          |
| **Runtime**                 | **Node.js**                        | `v20+ / v24+`                               | Event-Driven Asynchronous Engine             | Non-blocking I/O event loop allows high concurrent request throughput for file streaming and AI proxy requests.                                                        |
| **Databases & ORM**         | **Prisma ORM**                     | `^7.8.0`                                    | Multi-Schema Client & Migration Engine       | Generates type-safe query APIs directly from `.prisma` schemas, eliminating raw SQL errors while managing database schema migrations.                                  |
|                             | **MySQL / PostgreSQL**             | `8.0+ / 15+`                                | Relational Data Storage                      | Provides ACID transactional compliance for nested folders, shared access matrices, workspace files, and conversation threads.                                          |
|                             | **Decoupled Dual-DB Architecture** | _Custom Pattern_                            | Tenant & Licensing Isolation                 | Separates Central Identity/Auth (`central-core-db`) from Product Data (`p-1-db`), linked logically via `userUuid` for independent horizontal scaling.                  |
| **Artificial Intelligence** | **Google Gemini API**              | `^2.13.0` (`@google/genai`)                 | Multimodal LLM & Embedding Engine            | Natively parses scanned PDF documents (OCR), transcribes audio speech, extracts video scene timelines, translates 13 languages, and grounds answers.                   |
|                             | **Gemini Embeddings**              | `text-embedding-004`                        | Vector Representations                       | Converts scraped document text segments into 768-dimensional float arrays for Cosine Similarity vector retrieval.                                                      |
| **Background Processing**   | **BullMQ**                         | `^5.80.10`                                  | Redis Job Queue Manager                      | Offloads heavy document parsing, video frame processing, and chunk embedding tasks to background worker threads, preventing API timeouts.                              |
|                             | **Redis**                          | `6.2+ / 7+`                                 | In-Memory Data Store & Queue Broker          | Sub-millisecond queue state management, lock coordination, and retry state tracking.                                                                                   |
| **Document Parsers**        | **`pdf-parse`**                    | `^2.4.5`                                    | Local PDF Text Scraper                       | High-speed local text extraction from clean digital PDF files before resorting to AI OCR.                                                                              |
|                             | **`mammoth`**                      | `^1.12.0`                                   | Word `.docx` XML Text Extractor              | Direct XML raw text extraction from Word documents.                                                                                                                    |
| **Document Exporters**      | **`pdfkit`**                       | `^0.19.1`                                   | Programmatic PDF Builder                     | Programmatically builds page-wrapped PDF documents for translated document exports.                                                                                    |
|                             | **`docx`**                         | `^9.7.1`                                    | Programmatic Word File Generator             | Builds structured `.docx` files with headings and custom paragraph spacing for document exports.                                                                       |
| **Storage Drivers**         | **AWS S3 SDK**                     | `^3.1091.0` (`@aws-sdk/client-s3`)          | Cloud Object Storage Integration             | Streams file binaries to Amazon S3 buckets for cloud storage scaling.                                                                                                  |
|                             | **Local Disk Driver**              | _Custom Driver_                             | Local Filesystem Storage                     | Plug-and-play local filesystem storage driver for self-hosted installations.                                                                                           |
| **Security & Auth**         | **Passport.js & JWT**              | `^11.0.5` (`@nestjs/jwt`)                   | Session Verification & Guards                | Issues and verifies signed JWT tokens for API stateless authentication.                                                                                                |
|                             | **Google & Apple OAuth**           | `passport-google-oauth20`, `passport-apple` | Social Single Sign-On (SSO)                  | Multi-provider OAuth 2.0 authentication with automatic account linking by email.                                                                                       |
|                             | **Bcrypt.js**                      | `^3.0.3`                                    | Password Salt Hashing                        | One-way salt hashing for user password storage security.                                                                                                               |
|                             | **Class Validator**                | `^0.15.1` (`class-validator`)               | DTO Payload Validation                       | Intercepts invalid incoming request payloads before reaching controller handlers.                                                                                      |
| **Logging & Auditing**      | **Pino HTTP**                      | `^11.0.0` (`nestjs-pino`)                   | Structured Logger                            | High-performance JSON logger tracking API execution times, audit actions, and system errors.                                                                           |

---

## 2. Decoupled Multi-Database Architecture

To maintain strict tenant/product separation and support independent scaling of core authentication from product workloads, the backend utilizes two distinct MySQL/PostgreSQL databases managed by separate Prisma schemas:

```
                               ┌─────────────────────────────────────────┐
                               │       Client Gateway Request            │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │     NestJS Authentication Guard         │
                               └──────────┬───────────────────┬──────────┘
                                          │                   │
                     ┌────────────────────┴──┐             ┌──┴────────────────────┐
                     │ Central Core DB Client│             │ Product DB Client     │
                     └──────────┬────────────┘             └──┬────────────────────┘
                                │                             │
                                ▼                             ▼
                     ┌───────────────────────┐     ┌────────────────────────┐
                     │ central-core-db       │     │ p-1-db                 │
                     │  - Users              │     │  - Folders             │
                     │  - UserProfiles       │     │  - Files               │
                     │  - UserOAuthAccounts  │     │  - FileShares          │
                     │  - Roles & Permissions│     │  - FileDocumentChunks  │
                     │  - UserProductAccess  │     │  - ChatSessions        │
                     └───────────────────────┘     │  - ChatMessages        │
                                                   └────────────────────────┘
```

### Key Architectural Guarantee:

- **Logical Association via `userUuid`**: The product database contains zero hard foreign keys referencing the Central Core DB. All user references are stored as immutable `CHAR(36)` UUIDs (`user_uuid`), enabling complete physical separation or cloud migration of central auth services without altering workspace tables.

---

## 3. Exhaustive Data Dictionary & Entity-Relationship Model

### 3.1 Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    %% Central Core Database
    USER ||--o| USER_PROFILE : "has"
    USER ||--o{ USER_OAUTH_ACCOUNT : "authenticates via"
    USER ||--o{ USER_ROLE_LINK : "assigned"
    ROLE ||--o{ USER_ROLE_LINK : "belongs to"
    ROLE ||--o{ ROLE_PERMISSION : "grants"
    PERMISSION ||--o{ ROLE_PERMISSION : "linked in"
    USER ||--o{ USER_PRODUCT_ACCESS : "licensed for"
    PRODUCT ||--o{ USER_PRODUCT_ACCESS : "entitles"

    %% Product Workspace Database
    FOLDER ||--o{ FOLDER : "contains subfolders"
    FOLDER ||--o{ FILE : "contains files"
    FILE ||--o{ FILE_SHARE : "shared via"
    FILE ||--o{ FILE_DOCUMENT_CHUNK : "tokenized into"
    FILE ||--o| FILE_AI_SUMMARY : "summarized in"
    CHAT_SESSION ||--o{ CHAT_MESSAGE : "contains"

    USER {
        string uuid PK
        string email UK
        string passwordHash
        string status "ACTIVE | SUSPENDED | PENDING | BLOCKED"
    }

    FILE {
        string uuid PK
        string name
        string mimeType
        bigint size
        string extension
        string storageKey
        json embedding "768-dim vector"
        string userUuid
        string folderUuid FK
        boolean isStarred
        boolean isTrashed
    }

    FILE_DOCUMENT_CHUNK {
        string uuid PK
        string fileUuid FK
        integer chunkIndex
        string content
        json embedding "768-dim vector"
        integer tokenCount
    }

    CHAT_SESSION {
        string uuid PK
        string userUuid
        string title
        datetime updatedAt
    }

    CHAT_MESSAGE {
        string uuid PK
        string sessionUuid FK
        string sender "user | ai"
        string text
        json citations
    }
```

### 3.2 Detailed Database Schemas

#### A. Central Core Database (`central-core-db`)

| Table Name            | Column Name           | Data Type      | Constraints              | Description                                    |
| :-------------------- | :-------------------- | :------------- | :----------------------- | :--------------------------------------------- |
| `users`               | `id`                  | `BIGINT`       | `PK, Unsigned, Auto`     | Internal auto-increment primary key            |
|                       | `uuid`                | `CHAR(36)`     | `UNIQUE, NOT NULL`       | Universal unique identifier used cross-service |
|                       | `email`               | `VARCHAR(255)` | `UNIQUE, NOT NULL`       | User primary email address                     |
|                       | `password_hash`       | `VARCHAR(255)` | `NULLABLE`               | Bcrypt hashed password (null for OAuth users)  |
|                       | `status`              | `ENUM`         | `DEFAULT 'PENDING'`      | `ACTIVE`, `INACTIVE`, `PENDING`, `BLOCKED`     |
| `user_profiles`       | `user_id`             | `BIGINT`       | `FK -> users.id, UNIQUE` | One-to-one foreign key                         |
|                       | `first_name`          | `VARCHAR(100)` | `NOT NULL`               | First name                                     |
|                       | `last_name`           | `VARCHAR(100)` | `NOT NULL`               | Last name                                      |
|                       | `timezone`            | `VARCHAR(100)` | `DEFAULT 'Asia/Kolkata'` | Preferred user timezone                        |
| `user_oauth_accounts` | `provider`            | `ENUM`         | `NOT NULL`               | `GOOGLE` or `APPLE`                            |
|                       | `provider_account_id` | `VARCHAR(255)` | `NOT NULL`               | Unique ID from third-party provider            |
| `roles`               | `code`                | `VARCHAR(100)` | `UNIQUE, NOT NULL`       | E.g. `SUPER_ADMIN`, `MEMBER`                   |
| `permissions`         | `code`                | `VARCHAR(100)` | `UNIQUE, NOT NULL`       | E.g. `FILE_DELETE`, `AI_CHAT`                  |
| `user_product_access` | `status`              | `ENUM`         | `DEFAULT 'ACTIVE'`       | `ACTIVE`, `SUSPENDED`, `EXPIRED`, `REVOKED`    |

#### B. Product Database (`p-1-db`)

| Table Name             | Column Name    | Data Type      | Constraints                  | Description                                        |
| :--------------------- | :------------- | :------------- | :--------------------------- | :------------------------------------------------- |
| `folders`              | `uuid`         | `CHAR(36)`     | `UNIQUE, NOT NULL`           | Folder identifier                                  |
|                        | `name`         | `VARCHAR(255)` | `NOT NULL`                   | Folder visual title                                |
|                        | `parent_id`    | `BIGINT`       | `FK -> folders.id, NULLABLE` | Self-referential hierarchy link                    |
|                        | `user_uuid`    | `CHAR(36)`     | `NOT NULL, INDEX`            | Owner UUID reference                               |
| `files`                | `uuid`         | `CHAR(36)`     | `UNIQUE, NOT NULL`           | File identifier                                    |
|                        | `name`         | `VARCHAR(255)` | `NOT NULL`                   | Visual filename with extension                     |
|                        | `mime_type`    | `VARCHAR(100)` | `NOT NULL`                   | MIME type string (e.g. `application/pdf`)          |
|                        | `size`         | `BIGINT`       | `Unsigned, NOT NULL`         | File binary size in bytes                          |
|                        | `storage_key`  | `VARCHAR(500)` | `NOT NULL`                   | Path key on Local Disk or S3 Bucket                |
|                        | `embedding`    | `LONGTEXT`     | `NULLABLE`                   | JSON stringified 768-dim float array of name       |
| `file_document_chunks` | `file_uuid`    | `CHAR(36)`     | `NOT NULL, INDEX`            | Linked file UUID                                   |
|                        | `chunk_index`  | `INT`          | `NOT NULL`                   | Ordered chunk position (0, 1, 2...)                |
|                        | `content`      | `TEXT`         | `NOT NULL`                   | Scraped text segment                               |
|                        | `embedding`    | `LONGTEXT`     | `NOT NULL`                   | JSON stringified 768-dim float array of chunk      |
| `chat_sessions`        | `uuid`         | `CHAR(36)`     | `UNIQUE, NOT NULL`           | Conversation session thread identifier             |
|                        | `user_uuid`    | `CHAR(36)`     | `NOT NULL, INDEX`            | Owner UUID reference                               |
|                        | `title`        | `VARCHAR(255)` | `NOT NULL`                   | Title automatically generated from prompt          |
| `chat_messages`        | `session_uuid` | `CHAR(36)`     | `FK -> chat_sessions.uuid`   | Linked conversation thread                         |
|                        | `sender`       | `VARCHAR(10)`  | `NOT NULL`                   | `user` or `ai`                                     |
|                        | `text`         | `LONGTEXT`     | `NOT NULL`                   | Full conversation text payload                     |
|                        | `citations`    | `TEXT`         | `NULLABLE`                   | JSON array of `{ fileUuid, fileName, chunkIndex }` |

---

## 4. System Architecture & Multimodal Processing Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Application
    participant Gateway as NestJS API Gateway
    participant Auth as ProductEntitlement Guard
    participant Queue as BullMQ Job Processor
    participant Extractor as TextExtractor Service
    participant Gemini as Google Gemini AI Engine
    participant DB as Product Database (MySQL)

    User->>Gateway: POST /files/upload (Multipart file binaries)
    Gateway->>Auth: Validate JWT & Verify DRIVE_AI Entitlement
    Auth-->>Gateway: Authorized
    Gateway->>DB: Save File Record (status: PENDING)
    Gateway->>Queue: Enqueue Document Indexing Job
    Gateway-->>User: 202 Accepted { jobId, fileUuid }

    Queue->>Extractor: Process File Buffer (MIME / Extension)

    alt Standard PDF Parsing
        Extractor->>Extractor: parsePdf(buffer)
    else Scanned PDF (OCR Fallback)
        Extractor->>Gemini: generateContentMultimodal (PDF Base64)
        Gemini-->>Extractor: Extracted OCR Plaintext
    else Audio File (MP3/WAV)
        Extractor->>Gemini: transcribeAudio (Audio Buffer)
        Gemini-->>Extractor: Spoken Audio Transcript
    else Video File (MP4/MOV)
        Extractor->>Gemini: generateContentMultimodal (Video Base64)
        Gemini-->>Extractor: Visual Scene Timeline & Speech Transcript
    end

    Extractor-->>Queue: Plaintext Document Stream
    Queue->>Queue: Split into 500-token chunks
    Queue->>Gemini: generateEmbedding(chunkText)
    Gemini-->>Queue: 768-dimensional Float Array
    Queue->>DB: Save FileDocumentChunks & Vector Embeddings
    Queue-->>Gateway: Job Status Completed
```

---

## 5. Core Engine Specifications

### 5.1 Document Ingestion & Multimodal Processing Pipeline

The `TextExtractorService` converts uploaded binaries into searchable text:

1. **PDF Extraction with OCR Fallback**:
   - First attempts local text parsing via `PDFParse`.
   - If `PDFParse` fails or returns empty text (e.g. scanned/flattened image PDF), it triggers a fallback to Gemini's native PDF understanding via `generateContentMultimodal` passing `mimeType: 'application/pdf'`.
2. **Microsoft Word Processing**:
   - Parses `.docx` OpenXML text via `mammoth.extractRawText`.
   - If an older binary `.doc` file (Word 97-2003) is detected, it catches the signature error and raises a user-friendly `BadRequestException` instructing format conversion.
3. **Audio Transcription**:
   - Audio formats (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.webm`) are streamed to Gemini using `transcribeAudio`, returning spoken speech transcripts.
4. **Video Timeline & Scene Analysis**:
   - Video formats (`.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`) are passed to Gemini via `generateContentMultimodal`. Gemini outputs both spoken speech and timeline descriptions of visual actions, text overlays, and events.

### 5.2 Vector Embedding & Grounded RAG Engine

1. **Embedding Generation**:
   - Every document chunk is passed to Gemini's `text-embedding-004` model, yielding a 768-dimensional floating point vector.
2. **In-Memory Cosine Similarity Calculation**:
   Given query vector $\vec{A}$ and candidate chunk vector $\vec{B}$, the similarity score $S$ is calculated as:

   $$S(\vec{A}, \vec{B}) = \frac{\vec{A} \cdot \vec{B}}{\|\vec{A}\| \|\vec{B}\|} = \frac{\sum_{i=1}^{768} A_i B_i}{\sqrt{\sum_{i=1}^{768} A_i^2} \sqrt{\sum_{i=1}^{768} B_i^2}}$$

3. **Context Scoping & Grounding**:
   - **Global Search**: Filters candidates to files owned by or shared with the user.
   - **File-Scoped Search**: When `fileUuid` is provided, vector ranking is restricted exclusively to chunks matching `fileUuid`.

### 5.3 One-Click Neural Document Translation & Export Engine

1. **Endpoint**: `POST /ai/files/:fileUuid/translate`
2. **Translation**: The document text is extracted and translated to the target language via `geminiService.translateText`.
3. **Packaging via `DocumentExporterService`**:
   - **PDF Export**: Programmatically builds page-wrapped PDF documents using `pdfkit`.
   - **DOCX Export**: Constructs formatted Word documents with headings and paragraph structures using `docx`.
   - **TXT Export**: Produces plain UTF-8 encoded text buffers.
4. **Auto-Save**: Saves the exported buffer directly back to the user's workspace directory.

### 5.4 Real-Time Voice Dictation (STT) Engine

- **Endpoint**: `POST /ai/transcribe`
- Receives a multipart audio recording (`.webm`, `.mp3`, `.wav`) captured via HTML5 `MediaRecorder`.
- Invokes `geminiService.transcribeAudioDirect`, returning the transcribed string for input field population.

### 5.5 Database-Backed Conversational Session Manager

Chat history is persisted in `chat_sessions` and `chat_messages`:

- **Session Auto-Creation**: Creates a new session if `sessionUuid` is omitted.
- **Automatic Title Generation**: Automatically generates a 25-character session title from the first prompt.
- **Message Persistence**: Logs user queries and AI answers with JSON-stringified citation sources (`fileUuid`, `fileName`, `chunkIndex`).

---

## 6. Security, Authentication & Dynamic RBAC Engine

```
       Incoming Request ──► [JwtAuthGuard] ──► Decodes & Validates JWT Signature
                                 │
                                 ▼
                     [ProductAccessGuard] ──► Checks user_product_access table
                                 │            for status == 'ACTIVE' & code == 'DRIVE_AI'
                                 ▼
                      [RolesGuard] ──► Queries dynamic permissions matrix
                                 │     matching required module permissions
                                 ▼
                          Execute Controller
```

- **JWT Signatures**: Issued upon successful Email/Password, Google OAuth 2.0, or Sign in with Apple validation.
- **Product Entitlement Guard**: `@RequireProduct('DRIVE_AI')` decorator prevents unauthorized access if access status is `SUSPENDED`, `EXPIRED`, or `REVOKED`.

---

## 7. Pluggable Storage Driver Abstraction

The `StorageService` supports multiple storage backends configured via `.env`:

```typescript
export interface StorageDriver {
  saveFile(
    userUuid: string,
    buffer: Buffer,
    filename: string,
  ): Promise<StorageResult>;
  getFileBuffer(storageKey: string): Promise<Buffer>;
  deleteFile(storageKey: string): Promise<void>;
}
```

- **Local Storage Driver**: Saves files to disk under `./uploads/{userUuid}/`.
- **Amazon S3 Storage Driver**: Uploads files directly to S3 buckets using `@aws-sdk/client-s3`.

---

## 8. Background Processing & Queue Architecture

Heavy processing tasks are managed by **BullMQ** backed by Redis:

```
[Gateway Upload Endpoint]
         │
         ▼
 ┌───────────────┐
 │ BullMQ Queue  │ ──► [Worker Process] ──► Extractor -> Gemini -> Vector DB
 └───────────────┘       - Concurrency: 5
                         - Max Retries: 3 (exponential backoff)
```

---

## 9. Exhaustive API Reference Manual

### Authentication & User Session (`/auth`)

- `POST /auth/signup`: Create a new user account.
- `POST /auth/login`: Authenticate with email/password.
- `GET /auth/me`: Retrieve current user identity and entitlement access.
- `GET /auth/google`: Initiate Google OAuth 2.0 authentication flow.
- `GET /auth/apple`: Initiate Sign in with Apple authentication flow.

### Drive Directory Workspace (`/folders`, `/files`)

- `GET /folders`: List user folder tree hierarchy.
- `POST /folders`: Create a new folder.
- `DELETE /folders/:uuid`: Soft delete folder to Trash.
- `POST /files/upload`: Multipart upload single or multiple files.
- `GET /files/:uuid/download`: Stream file binary payload.
- `PATCH /files/:uuid/trash`: Move file to Trash or restore.
- `DELETE /files/:uuid/permanent`: Permanently remove file and vector chunks.

### Grounded AI Copilot & Document Services (`/ai`)

- `POST /ai/chat`: Send chat prompt (`question`, optional `sessionUuid`, optional `fileUuid`).
- `GET /ai/sessions`: List user chat sessions.
- `GET /ai/sessions/:sessionUuid/messages`: List all messages in a session thread.
- `DELETE /ai/sessions/:sessionUuid`: Delete chat session thread.
- `POST /ai/files/:fileUuid/translate`: Translate document and export as PDF/DOCX/TXT.
- `POST /ai/transcribe`: Transcribe uploaded voice clip to text string.

---

## 10. Developer Setup & Operations Guide

### 1. Environment Configuration (`.env`)

```env
# Server
PORT=7001
# Environment
NODE_ENV=development
# Logging
LOG_LEVEL=debug

# Timezone
TZ=UTC
DEFAULT_TIMEZONE="Asia/Kolkata"

# Frontend URL(s) for CORS — e.g. Next.js on port 3000
CORS_ORIGIN=http://localhost:3000

# Optional — preflight cache (seconds). Omit for default 600.
CORS_MAX_AGE=600

# Database
DATABASE_URL="mysql://root:root@1234@localhost:3306/p-1-db" // repalce url with your if are deploying
DATABASE_READ_URL="mysql://root:root@1234@localhost:3306/p-1-db" // repalce url with your if are deploying

# Central Core Database
CENTRAL_CORE_DATABASE_URL="mysql://root:root%401234@localhost:3306/central-core-db"
CENTRAL_CORE_DATABASE_READ_URL="mysql://root:root%401234@localhost:3306/central-core-db"

# JWT
JWT_SECRET="liladhar346346%#"
JWT_EXPIRATION_TIME=1d

# Redis Config for BullMQ
REDIS_HOST="localhost"
REDIS_PORT=6379
# REDIS_PASSWORD="your-redis-password"

# File Storage Driver (Set to 'local' for local storage, or 's3' for AWS S3 / Cloudflare R2)
STORAGE_DRIVER="s3"

# AWS S3 / Cloudflare R2 Credentials
AWS_ACCESS_KEY_ID="aws acces acces key"
AWS_SECRET_ACCESS_KEY="your aws secret"
AWS_S3_BUCKET="drive-ai"
AWS_REGION="auto" # Default for R2 is 'auto'
AWS_S3_ENDPOINT="add endpoint # Required for Cloudflare R2 / S3-compatible APIs

# Google Gemini API Key for AI Document Intelligence & RAG Suite
GEMINI_API_KEY="add you google gemine api from google studio"

# Google Auth
GOOGLE_CLIENT_ID="google client id from google console"
GOOGLE_CLIENT_SECRET="google client secret from a google console"
GOOGLE_CALLBACK_URL="http://localhost:7001/auth/google/callback"

# Apple Auth
APPLE_CLIENT_ID="your-apple-client-id"
APPLE_TEAM_ID="your-apple-team-id"
APPLE_KEY_ID="your-apple-key-id"
APPLE_CALLBACK_URL="http://localhost:7001/auth/apple/callback"

```

### 2. Database Migrations

```bash
# Push schema changes to both databases
npx prisma db push --config prisma.config.ts
npx prisma db push --config prisma-central-core.config.ts

# Generate both Prisma Clients
npm run postinstall
```

### 3. Server Operations

```bash
# Start development server
npm run start:dev

# Run Jest unit test suite (70 tests)
npm test

# Run ESLint fix check
npm run lint
```

---

## 📬 Contact & Contribution

Contributions, issues, and feature requests are welcome! Feel free to check out the repository or reach out:

- **Developer Portfolio & Info**: [https://www.liladhar.com/](https://www.liladhar.com/)
