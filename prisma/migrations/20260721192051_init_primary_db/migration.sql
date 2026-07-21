-- CreateTable
CREATE TABLE `folders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `color` VARCHAR(20) NULL DEFAULT '#4285F4',
    `user_uuid` CHAR(36) NOT NULL,
    `parent_id` BIGINT UNSIGNED NULL,
    `is_starred` BOOLEAN NOT NULL DEFAULT false,
    `is_trashed` BOOLEAN NOT NULL DEFAULT false,
    `trashed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `folders_uuid_key`(`uuid`),
    INDEX `folders_user_uuid_parent_id_idx`(`user_uuid`, `parent_id`),
    INDEX `folders_user_uuid_is_trashed_idx`(`user_uuid`, `is_trashed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `files` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size` BIGINT UNSIGNED NOT NULL,
    `extension` VARCHAR(20) NOT NULL,
    `storage_driver` VARCHAR(20) NOT NULL DEFAULT 'local',
    `storage_key` VARCHAR(500) NOT NULL,
    `storage_url` VARCHAR(1000) NULL,
    `user_uuid` CHAR(36) NOT NULL,
    `folder_uuid` CHAR(36) NULL,
    `is_starred` BOOLEAN NOT NULL DEFAULT false,
    `is_trashed` BOOLEAN NOT NULL DEFAULT false,
    `trashed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `files_uuid_key`(`uuid`),
    INDEX `files_user_uuid_folder_uuid_idx`(`user_uuid`, `folder_uuid`),
    INDEX `files_user_uuid_is_trashed_idx`(`user_uuid`, `is_trashed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `folders` ADD CONSTRAINT `folders_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
