-- AlterTable
ALTER TABLE `LiveStream`
    ADD COLUMN `providerChannelId` VARCHAR(255) NULL,
    ADD COLUMN `liveVideoId` VARCHAR(255) NULL,
    ADD COLUMN `autoDetect` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `lastCheckedAt` DATETIME(3) NULL,
    ADD COLUMN `lastStatusError` TEXT NULL;
