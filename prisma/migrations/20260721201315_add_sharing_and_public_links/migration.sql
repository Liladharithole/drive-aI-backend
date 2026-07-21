-- CreateTable
CREATE TABLE `file_shares` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `file_uuid` CHAR(36) NULL,
    `folder_uuid` CHAR(36) NULL,
    `shared_by_uuid` CHAR(36) NOT NULL,
    `shared_with_email` VARCHAR(255) NOT NULL,
    `access_level` ENUM('VIEWER', 'EDITOR') NOT NULL DEFAULT 'VIEWER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `file_shares_uuid_key`(`uuid`),
    INDEX `file_shares_shared_with_email_idx`(`shared_with_email`),
    UNIQUE INDEX `file_shares_file_uuid_shared_with_email_key`(`file_uuid`, `shared_with_email`),
    UNIQUE INDEX `file_shares_folder_uuid_shared_with_email_key`(`folder_uuid`, `shared_with_email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `public_links` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `access_key` VARCHAR(255) NOT NULL,
    `file_uuid` CHAR(36) NULL,
    `folder_uuid` CHAR(36) NULL,
    `created_by` CHAR(36) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `public_links_uuid_key`(`uuid`),
    UNIQUE INDEX `public_links_access_key_key`(`access_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
