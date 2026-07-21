-- Complete the administration data required by the protected WST workflows.
ALTER TABLE `Role`
    ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `GangRole`
    ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `archivedAt` DATETIME(3) NULL;

ALTER TABLE `Player`
    ADD COLUMN `externalFivemId` VARCHAR(128) NULL,
    ADD UNIQUE INDEX `Player_externalFivemId_key` (`externalFivemId`);

ALTER TABLE `Tournament`
    ADD COLUMN `featured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `publicVisible` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `Match`
    ADD COLUMN `streamId` VARCHAR(191) NULL,
    ADD COLUMN `resultNotes` TEXT NULL,
    ADD COLUMN `disputeReason` TEXT NULL,
    ADD COLUMN `disputeNotes` LONGTEXT NULL,
    ADD COLUMN `disputeAssignedUserId` VARCHAR(191) NULL,
    ADD INDEX `Match_streamId_idx` (`streamId`),
    ADD INDEX `Match_disputeAssignedUserId_idx` (`disputeAssignedUserId`),
    ADD CONSTRAINT `Match_streamId_fkey` FOREIGN KEY (`streamId`) REFERENCES `LiveStream` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `Match_disputeAssignedUserId_fkey` FOREIGN KEY (`disputeAssignedUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Event`
    ADD COLUMN `archivedAt` DATETIME(3) NULL;

ALTER TABLE `LiveStream`
    ADD COLUMN `archivedAt` DATETIME(3) NULL;

ALTER TABLE `MatchPlayerStat`
    ADD COLUMN `score` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `played` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notes` TEXT NULL;

ALTER TABLE `MediaAsset`
    MODIFY COLUMN `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'PENDING';
