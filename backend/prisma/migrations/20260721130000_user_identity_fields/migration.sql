-- Add the normalized registration identity fields as nullable so existing
-- accounts can be backfilled safely before enforcing the final constraints.
ALTER TABLE `User`
  ADD COLUMN `firstName` VARCHAR(100) NULL,
  ADD COLUMN `lastName` VARCHAR(100) NULL,
  ADD COLUMN `username` VARCHAR(30) NULL;

UPDATE `User`
SET
  `firstName` = CASE
    WHEN CHAR_LENGTH(TRIM(`name`)) >= 2 THEN LEFT(TRIM(`name`), 100)
    ELSE CONCAT('User ', LEFT(`id`, 8))
  END,
  `username` = LEFT(CONCAT('user_', REPLACE(`id`, '-', '')), 30);

ALTER TABLE `User`
  MODIFY `firstName` VARCHAR(100) NOT NULL,
  MODIFY `username` VARCHAR(30) NOT NULL;

DROP INDEX `User_name_idx` ON `User`;
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);
CREATE INDEX `User_firstName_lastName_idx` ON `User`(`firstName`, `lastName`);

ALTER TABLE `User`
  ADD CONSTRAINT `User_firstName_length_check`
    CHECK (CHAR_LENGTH(TRIM(`firstName`)) BETWEEN 2 AND 100),
  ADD CONSTRAINT `User_lastName_length_check`
    CHECK (`lastName` IS NULL OR CHAR_LENGTH(TRIM(`lastName`)) BETWEEN 2 AND 100),
  ADD CONSTRAINT `User_username_length_check`
    CHECK (CHAR_LENGTH(`username`) BETWEEN 5 AND 30),
  DROP COLUMN `name`;
