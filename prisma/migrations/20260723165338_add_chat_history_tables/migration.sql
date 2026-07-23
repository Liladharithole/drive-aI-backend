-- CreateTable
CREATE TABLE `chat_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_uuid` CHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `chat_sessions_uuid_key`(`uuid`),
    INDEX `chat_sessions_user_uuid_idx`(`user_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `session_uuid` CHAR(36) NOT NULL,
    `sender` VARCHAR(10) NOT NULL,
    `text` LONGTEXT NOT NULL,
    `citations` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `chat_messages_uuid_key`(`uuid`),
    INDEX `chat_messages_session_uuid_idx`(`session_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_session_uuid_fkey` FOREIGN KEY (`session_uuid`) REFERENCES `chat_sessions`(`uuid`) ON DELETE CASCADE ON UPDATE CASCADE;
