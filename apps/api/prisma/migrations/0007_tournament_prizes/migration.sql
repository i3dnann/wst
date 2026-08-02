-- Store the three tournament podium prizes as structured, editable records.
CREATE TABLE `TournamentPrize` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `placement` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `amount` VARCHAR(191) NOT NULL,
    `imageUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TournamentPrize_tournamentId_placement_key`(`tournamentId`, `placement`),
    INDEX `TournamentPrize_tournamentId_idx`(`tournamentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TournamentPrize`
    ADD CONSTRAINT `TournamentPrize_tournamentId_fkey`
    FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
