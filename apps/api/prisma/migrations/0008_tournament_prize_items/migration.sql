-- Allow each podium placement to contain an ordered collection of reward items.
ALTER TABLE `TournamentPrize`
    ADD COLUMN `itemOrder` INTEGER NOT NULL DEFAULT 0;

DROP INDEX `TournamentPrize_tournamentId_placement_key` ON `TournamentPrize`;
DROP INDEX `TournamentPrize_tournamentId_idx` ON `TournamentPrize`;

CREATE UNIQUE INDEX `TournamentPrize_tournamentId_placement_itemOrder_key`
    ON `TournamentPrize`(`tournamentId`, `placement`, `itemOrder`);
CREATE INDEX `TournamentPrize_tournamentId_placement_idx`
    ON `TournamentPrize`(`tournamentId`, `placement`);
