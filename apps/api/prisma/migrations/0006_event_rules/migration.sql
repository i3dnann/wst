-- Give public events a dedicated long-form rules section that administrators
-- can manage independently from the event description.
ALTER TABLE `Event`
    ADD COLUMN `rules` LONGTEXT NULL;
