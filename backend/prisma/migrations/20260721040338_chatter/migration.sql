-- AlterTable
ALTER TABLE `conversation` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `groupAvatarUrl` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `participant` ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `pinnedAt` DATETIME(3) NULL,
    ADD COLUMN `role` ENUM('OWNER', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    ADD COLUMN `unreadCount` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Participant_userId_archivedAt_pinnedAt_idx` ON `Participant`(`userId`, `archivedAt`, `pinnedAt`);
