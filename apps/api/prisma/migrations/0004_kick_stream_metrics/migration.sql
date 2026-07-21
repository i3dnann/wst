-- Store live provider metadata used by the public stream dashboard.
ALTER TABLE `LiveStream`
    ADD COLUMN `viewerCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `streamTitle` VARCHAR(500) NULL,
    ADD COLUMN `categoryName` VARCHAR(255) NULL,
    ADD COLUMN `liveStartedAt` DATETIME(3) NULL;
