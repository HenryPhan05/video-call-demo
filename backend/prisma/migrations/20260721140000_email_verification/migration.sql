-- Existing accounts predate email verification, so preserve their access.
ALTER TABLE `User` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL;
UPDATE `User` SET `emailVerifiedAt` = CURRENT_TIMESTAMP(3) WHERE `emailVerifiedAt` IS NULL;

CREATE TABLE `EmailVerificationToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `codeHash` CHAR(64) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailVerificationToken_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmailVerificationToken`
ADD CONSTRAINT `EmailVerificationToken_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
