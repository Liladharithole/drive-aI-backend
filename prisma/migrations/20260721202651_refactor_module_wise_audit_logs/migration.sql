/*
  Warnings:

  - You are about to drop the `activity_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `activity_logs`;

-- CreateTable
CREATE TABLE `file_activity_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_uuid` CHAR(36) NOT NULL,
    `file_uuid` CHAR(36) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `details` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_activity_logs_uuid_key`(`uuid`),
    INDEX `file_activity_logs_user_uuid_idx`(`user_uuid`),
    INDEX `file_activity_logs_file_uuid_idx`(`file_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `folder_activity_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_uuid` CHAR(36) NOT NULL,
    `folder_uuid` CHAR(36) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `details` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `folder_activity_logs_uuid_key`(`uuid`),
    INDEX `folder_activity_logs_user_uuid_idx`(`user_uuid`),
    INDEX `folder_activity_logs_folder_uuid_idx`(`folder_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `share_activity_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_uuid` CHAR(36) NOT NULL,
    `item_type` VARCHAR(20) NOT NULL,
    `item_uuid` CHAR(36) NOT NULL,
    `shared_with_email` VARCHAR(255) NULL,
    `action` VARCHAR(50) NOT NULL,
    `details` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `share_activity_logs_uuid_key`(`uuid`),
    INDEX `share_activity_logs_user_uuid_idx`(`user_uuid`),
    INDEX `share_activity_logs_item_uuid_idx`(`item_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
