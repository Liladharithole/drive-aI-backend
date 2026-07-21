-- CreateTable
CREATE TABLE `file_ai_summaries` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `file_uuid` CHAR(36) NOT NULL,
    `summary` TEXT NOT NULL,
    `key_takeaways` TEXT NOT NULL,
    `document_type` VARCHAR(50) NULL,
    `language` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `file_ai_summaries_uuid_key`(`uuid`),
    UNIQUE INDEX `file_ai_summaries_file_uuid_key`(`file_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_document_chunks` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `file_uuid` CHAR(36) NOT NULL,
    `chunk_index` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `embedding` LONGTEXT NOT NULL,
    `token_count` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_document_chunks_uuid_key`(`uuid`),
    INDEX `file_document_chunks_file_uuid_idx`(`file_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_chat_histories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `file_uuid` CHAR(36) NOT NULL,
    `user_uuid` CHAR(36) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `sources` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ai_chat_histories_uuid_key`(`uuid`),
    INDEX `ai_chat_histories_file_uuid_user_uuid_idx`(`file_uuid`, `user_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
