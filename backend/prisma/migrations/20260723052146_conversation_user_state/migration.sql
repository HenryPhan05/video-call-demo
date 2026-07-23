-- AlterTable
ALTER TABLE `participant` ADD COLUMN `clearedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Participant_userId_deletedAt_archivedAt_idx` ON `Participant`(`userId`, `deletedAt`, `archivedAt`);
