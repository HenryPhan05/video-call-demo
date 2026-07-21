-- CreateIndex
CREATE INDEX `MessageReaction_userId_idx` ON `MessageReaction`(`userId`);

-- AddForeignKey
ALTER TABLE `MessageReaction` ADD CONSTRAINT `MessageReaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
