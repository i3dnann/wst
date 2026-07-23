-- Keep cancelled matches publishable while allowing administrators to remove
-- a match from every public and administrative view.
ALTER TABLE `Match`
    ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE INDEX `Match_deletedAt_idx` ON `Match`(`deletedAt`);

-- Previous releases implemented the admin delete endpoint as CANCELLED and
-- recorded the operation as match.cancel. Migrate only those legacy deletes;
-- matches cancelled through the normal status editor remain publishable.
UPDATE `Match` AS `matchRecord`
INNER JOIN (
    SELECT `entityId`, MAX(`createdAt`) AS `deletedAt`
    FROM `AuditLog`
    WHERE `entityType` = 'Match'
      AND `action` = 'match.cancel'
      AND `entityId` IS NOT NULL
    GROUP BY `entityId`
) AS `legacyDelete` ON `legacyDelete`.`entityId` = `matchRecord`.`id`
SET `matchRecord`.`deletedAt` = `legacyDelete`.`deletedAt`
WHERE `matchRecord`.`status` = 'CANCELLED';
