-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `username` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `avatarUrl` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,

    UNIQUE INDEX `Permission_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `gangId` VARCHAR(191) NULL,

    INDEX `UserRole_gangId_idx`(`gangId`),
    UNIQUE INDEX `UserRole_userId_roleId_gangId_key`(`userId`, `roleId`, `gangId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Gang` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NOT NULL,
    `motto` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `history` LONGTEXT NULL,
    `logoUrl` TEXT NULL,
    `bannerUrl` TEXT NULL,
    `primaryColor` VARCHAR(191) NULL,
    `secondaryColor` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `recruitmentStatus` ENUM('OPEN', 'CLOSED', 'INVITE_ONLY') NOT NULL DEFAULT 'CLOSED',
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `foundedAt` DATETIME(3) NULL,
    `territory` VARCHAR(191) NULL,
    `currentRank` INTEGER NULL,
    `previousRank` INTEGER NULL,
    `peakRank` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Gang_slug_key`(`slug`),
    UNIQUE INDEX `Gang_tag_key`(`tag`),
    INDEX `Gang_status_currentRank_idx`(`status`, `currentRank`),
    INDEX `Gang_featured_idx`(`featured`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GangRole` (
    `id` VARCHAR(191) NOT NULL,
    `gangId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `hierarchyLevel` INTEGER NOT NULL,
    `public` BOOLEAN NOT NULL DEFAULT true,
    `leadership` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `GangRole_gangId_name_key`(`gangId`, `name`),
    UNIQUE INDEX `GangRole_gangId_hierarchyLevel_key`(`gangId`, `hierarchyLevel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Player` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `avatarUrl` TEXT NULL,
    `biography` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Player_slug_key`(`slug`),
    UNIQUE INDEX `Player_userId_key`(`userId`),
    INDEX `Player_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GangMembership` (
    `id` VARCHAR(191) NOT NULL,
    `gangId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `gangRoleId` VARCHAR(191) NOT NULL,
    `callsign` VARCHAR(191) NULL,
    `joinedAt` DATETIME(3) NOT NULL,
    `leftAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GangMembership_playerId_active_idx`(`playerId`, `active`),
    INDEX `GangMembership_gangId_active_idx`(`gangId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Season` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `scoringConfigSnapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Season_slug_key`(`slug`),
    INDEX `Season_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tournament` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `bannerUrl` TEXT NULL,
    `format` ENUM('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'GROUP_KNOCKOUT', 'CUSTOM') NOT NULL,
    `status` ENUM('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `seasonId` VARCHAR(191) NULL,
    `registrationOpenAt` DATETIME(3) NULL,
    `registrationCloseAt` DATETIME(3) NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NULL,
    `maximumParticipants` INTEGER NOT NULL,
    `rules` LONGTEXT NULL,
    `prizeDescription` TEXT NULL,
    `organizerUserId` VARCHAR(191) NOT NULL,
    `bracketVersion` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Tournament_slug_key`(`slug`),
    INDEX `Tournament_status_startAt_idx`(`status`, `startAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TournamentParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `gangId` VARCHAR(191) NOT NULL,
    `seed` INTEGER NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'ELIMINATED', 'CHAMPION') NOT NULL DEFAULT 'PENDING',
    `registeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,

    UNIQUE INDEX `TournamentParticipant_tournamentId_gangId_key`(`tournamentId`, `gangId`),
    UNIQUE INDEX `TournamentParticipant_tournamentId_seed_key`(`tournamentId`, `seed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TournamentRoster` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentParticipantId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NULL,
    `starter` BOOLEAN NOT NULL DEFAULT false,
    `approved` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `TournamentRoster_tournamentParticipantId_playerId_key`(`tournamentParticipantId`, `playerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BracketRound` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `bracketType` ENUM('WINNERS', 'LOSERS', 'FINALS', 'GROUP') NOT NULL,
    `roundNumber` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,

    UNIQUE INDEX `BracketRound_tournamentId_bracketType_roundNumber_key`(`tournamentId`, `bracketType`, `roundNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Match` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NULL,
    `bracketRoundId` VARCHAR(191) NULL,
    `nextMatchId` VARCHAR(191) NULL,
    `loserNextMatchId` VARCHAR(191) NULL,
    `gangAId` VARCHAR(191) NULL,
    `gangBId` VARCHAR(191) NULL,
    `gangAScore` INTEGER NULL,
    `gangBScore` INTEGER NULL,
    `winnerGangId` VARCHAR(191) NULL,
    `status` ENUM('SCHEDULED', 'CHECK_IN_OPEN', 'READY', 'LIVE', 'AWAITING_RESULT', 'DISPUTED', 'COMPLETED', 'CANCELLED', 'FORFEIT') NOT NULL DEFAULT 'SCHEDULED',
    `bestOf` INTEGER NOT NULL DEFAULT 1,
    `scheduledAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `finalizedAt` DATETIME(3) NULL,
    `finalizedByUserId` VARCHAR(191) NULL,
    `reopenedAt` DATETIME(3) NULL,
    `reopenReason` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `position` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Match_tournamentId_status_scheduledAt_idx`(`tournamentId`, `status`, `scheduledAt`),
    INDEX `Match_nextMatchId_idx`(`nextMatchId`),
    UNIQUE INDEX `Match_bracketRoundId_position_key`(`bracketRoundId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `imageUrl` TEXT NULL,
    `location` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Event_slug_key`(`slug`),
    INDEX `Event_status_startsAt_idx`(`status`, `startsAt`),
    INDEX `Event_featured_startsAt_idx`(`featured`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveStream` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `streamerName` VARCHAR(191) NOT NULL,
    `platform` ENUM('TWITCH', 'YOUTUBE', 'KICK', 'OTHER') NOT NULL,
    `channelUrl` TEXT NOT NULL,
    `embedUrl` TEXT NULL,
    `thumbnailUrl` TEXT NULL,
    `status` ENUM('SCHEDULED', 'LIVE', 'OFFLINE', 'ARCHIVED') NOT NULL DEFAULT 'OFFLINE',
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `tournamentId` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LiveStream_slug_key`(`slug`),
    INDEX `LiveStream_status_featured_updatedAt_idx`(`status`, `featured`, `updatedAt`),
    INDEX `LiveStream_tournamentId_idx`(`tournamentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MatchPlayerStat` (
    `id` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `gangId` VARCHAR(191) NOT NULL,
    `kills` INTEGER NOT NULL DEFAULT 0,
    `deaths` INTEGER NOT NULL DEFAULT 0,
    `assists` INTEGER NOT NULL DEFAULT 0,
    `roundsPlayed` INTEGER NOT NULL DEFAULT 0,
    `mvp` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MatchPlayerStat_gangId_matchId_idx`(`gangId`, `matchId`),
    UNIQUE INDEX `MatchPlayerStat_matchId_playerId_key`(`matchId`, `playerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MvpAward` (
    `id` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `gangId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NULL,
    `tournamentId` VARCHAR(191) NULL,
    `seasonId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `statisticsSnapshot` JSON NOT NULL,
    `awardedByUserId` VARCHAR(191) NOT NULL,
    `awardedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MvpAward_playerId_awardedAt_idx`(`playerId`, `awardedAt`),
    UNIQUE INDEX `MvpAward_matchId_type_key`(`matchId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GangSeasonStat` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `gangId` VARCHAR(191) NOT NULL,
    `matchesPlayed` INTEGER NOT NULL DEFAULT 0,
    `wins` INTEGER NOT NULL DEFAULT 0,
    `losses` INTEGER NOT NULL DEFAULT 0,
    `draws` INTEGER NOT NULL DEFAULT 0,
    `kills` INTEGER NOT NULL DEFAULT 0,
    `deaths` INTEGER NOT NULL DEFAULT 0,
    `points` INTEGER NOT NULL DEFAULT 0,
    `currentRank` INTEGER NULL,
    `previousRank` INTEGER NULL,
    `peakRank` INTEGER NULL,
    `streak` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GangSeasonStat_seasonId_points_idx`(`seasonId`, `points`),
    UNIQUE INDEX `GangSeasonStat_seasonId_gangId_key`(`seasonId`, `gangId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerSeasonStat` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `gangId` VARCHAR(191) NULL,
    `matchesPlayed` INTEGER NOT NULL DEFAULT 0,
    `wins` INTEGER NOT NULL DEFAULT 0,
    `losses` INTEGER NOT NULL DEFAULT 0,
    `kills` INTEGER NOT NULL DEFAULT 0,
    `deaths` INTEGER NOT NULL DEFAULT 0,
    `assists` INTEGER NOT NULL DEFAULT 0,
    `mvpAwards` INTEGER NOT NULL DEFAULT 0,
    `points` INTEGER NOT NULL DEFAULT 0,
    `currentRank` INTEGER NULL,
    `previousRank` INTEGER NULL,
    `peakRank` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PlayerSeasonStat_seasonId_points_idx`(`seasonId`, `points`),
    UNIQUE INDEX `PlayerSeasonStat_seasonId_playerId_key`(`seasonId`, `playerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RankingEvent` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `entityType` ENUM('GANG', 'PLAYER') NOT NULL,
    `entityId` VARCHAR(30) NOT NULL,
    `eventType` VARCHAR(64) NOT NULL,
    `points` INTEGER NOT NULL,
    `sourceType` VARCHAR(64) NOT NULL,
    `sourceId` VARCHAR(30) NOT NULL,
    `description` TEXT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RankingEvent_seasonId_entityType_entityId_createdAt_idx`(`seasonId`, `entityType`, `entityId`, `createdAt`),
    UNIQUE INDEX `RankingEvent_seasonId_entityType_entityId_sourceType_sourceI_key`(`seasonId`, `entityType`, `entityId`, `sourceType`, `sourceId`, `eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `uploaderUserId` VARCHAR(191) NOT NULL,
    `gangId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(255) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `publicUrl` TEXT NOT NULL,
    `mimeType` VARCHAR(127) NOT NULL,
    `size` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'DELETED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `reviewedByUserId` VARCHAR(191) NULL,

    UNIQUE INDEX `MediaAsset_storageKey_key`(`storageKey`),
    INDEX `MediaAsset_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(128) NOT NULL,
    `entityType` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(30) NULL,
    `beforeData` JSON NULL,
    `afterData` JSON NULL,
    `reason` TEXT NULL,
    `ipHash` CHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    INDEX `AuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlatformSetting` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updatedByUserId` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlatformSetting_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_gangId_fkey` FOREIGN KEY (`gangId`) REFERENCES `Gang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GangRole` ADD CONSTRAINT `GangRole_gangId_fkey` FOREIGN KEY (`gangId`) REFERENCES `Gang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Player` ADD CONSTRAINT `Player_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GangMembership` ADD CONSTRAINT `GangMembership_gangId_fkey` FOREIGN KEY (`gangId`) REFERENCES `Gang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GangMembership` ADD CONSTRAINT `GangMembership_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GangMembership` ADD CONSTRAINT `GangMembership_gangRoleId_fkey` FOREIGN KEY (`gangRoleId`) REFERENCES `GangRole`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tournament` ADD CONSTRAINT `Tournament_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tournament` ADD CONSTRAINT `Tournament_organizerUserId_fkey` FOREIGN KEY (`organizerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentParticipant` ADD CONSTRAINT `TournamentParticipant_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentParticipant` ADD CONSTRAINT `TournamentParticipant_gangId_fkey` FOREIGN KEY (`gangId`) REFERENCES `Gang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentRoster` ADD CONSTRAINT `TournamentRoster_tournamentParticipantId_fkey` FOREIGN KEY (`tournamentParticipantId`) REFERENCES `TournamentParticipant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentRoster` ADD CONSTRAINT `TournamentRoster_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BracketRound` ADD CONSTRAINT `BracketRound_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_bracketRoundId_fkey` FOREIGN KEY (`bracketRoundId`) REFERENCES `BracketRound`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_nextMatchId_fkey` FOREIGN KEY (`nextMatchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_loserNextMatchId_fkey` FOREIGN KEY (`loserNextMatchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_gangAId_fkey` FOREIGN KEY (`gangAId`) REFERENCES `Gang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_gangBId_fkey` FOREIGN KEY (`gangBId`) REFERENCES `Gang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_winnerGangId_fkey` FOREIGN KEY (`winnerGangId`) REFERENCES `Gang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_finalizedByUserId_fkey` FOREIGN KEY (`finalizedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveStream` ADD CONSTRAINT `LiveStream_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveStream` ADD CONSTRAINT `LiveStream_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchPlayerStat` ADD CONSTRAINT `MatchPlayerStat_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchPlayerStat` ADD CONSTRAINT `MatchPlayerStat_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchPlayerStat` ADD CONSTRAINT `MatchPlayerStat_gangId_fkey` FOREIGN KEY (`gangId`) REFERENCES `Gang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MvpAward` ADD CONSTRAINT `MvpAward_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MvpAward` ADD CONSTRAINT `MvpAward_gangId_fkey` FOREIGN KEY (`gangId`) REFERENCES `Gang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MvpAward` ADD CONSTRAINT `MvpAward_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MvpAward` ADD CONSTRAINT `MvpAward_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MvpAward` ADD CONSTRAINT `MvpAward_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MvpAward` ADD CONSTRAINT `MvpAward_awardedByUserId_fkey` FOREIGN KEY (`awardedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GangSeasonStat` ADD CONSTRAINT `GangSeasonStat_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GangSeasonStat` ADD CONSTRAINT `GangSeasonStat_gangId_fkey` FOREIGN KEY (`gangId`) REFERENCES `Gang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerSeasonStat` ADD CONSTRAINT `PlayerSeasonStat_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerSeasonStat` ADD CONSTRAINT `PlayerSeasonStat_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankingEvent` ADD CONSTRAINT `RankingEvent_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankingEvent` ADD CONSTRAINT `RankingEvent_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_uploaderUserId_fkey` FOREIGN KEY (`uploaderUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_gangId_fkey` FOREIGN KEY (`gangId`) REFERENCES `Gang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlatformSetting` ADD CONSTRAINT `PlatformSetting_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
