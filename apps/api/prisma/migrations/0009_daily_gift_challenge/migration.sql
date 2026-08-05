CREATE TABLE `GiftChallenge` (
    `id` VARCHAR(32) NOT NULL DEFAULT 'daily-gift',
    `code` VARCHAR(255) NOT NULL,
    `requiredClicks` INTEGER NOT NULL DEFAULT 100,
    `claimedAt` DATETIME(3) NULL,
    `claimedCode` VARCHAR(255) NULL,
    `claimTokenHash` CHAR(64) NULL,
    `updatedByUserId` VARCHAR(30) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GiftChallenge_claimedAt_idx`(`claimedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GiftChallengeAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GiftChallengeAttempt_tokenHash_key`(`tokenHash`),
    INDEX `GiftChallengeAttempt_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `GiftChallenge` (`id`, `code`, `requiredClicks`, `updatedAt`)
VALUES ('daily-gift', 'Adnanwashere2001', 100, CURRENT_TIMESTAMP(3));
