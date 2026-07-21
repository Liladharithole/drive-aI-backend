-- CreateTable
CREATE TABLE `activity_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_uuid` CHAR(36) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `item_type` VARCHAR(20) NOT NULL,
    `item_uuid` CHAR(36) NOT NULL,
    `item_name` VARCHAR(255) NOT NULL,
    `details` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `activity_logs_uuid_key`(`uuid`),
    INDEX `activity_logs_user_uuid_idx`(`user_uuid`),
    INDEX `activity_logs_item_uuid_idx`(`item_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
