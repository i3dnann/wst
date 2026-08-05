ALTER TABLE `GiftChallengeAttempt`
    ADD COLUMN `puzzleCode` VARCHAR(11) NULL,
    ADD COLUMN `revealUntil` DATETIME(3) NULL,
    ADD COLUMN `answerUntil` DATETIME(3) NULL,
    ADD COLUMN `attemptsRemaining` INTEGER NOT NULL DEFAULT 3;
