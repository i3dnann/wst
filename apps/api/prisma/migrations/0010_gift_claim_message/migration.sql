ALTER TABLE `GiftChallenge`
    ADD COLUMN `claimMessage` TEXT NULL;

UPDATE `GiftChallenge`
SET `claimMessage` = 'DM a World Star administrator on Discord and send this code to claim your gift.'
WHERE `claimMessage` IS NULL;
