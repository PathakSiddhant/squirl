-- Whether Signal is paused, and the moment it last resumed.
--
-- A single row. Pausing has to survive a restart, because an always-on process
-- that quietly started syncing again after a reboot would be a pause that only
-- lasts until the next power cut, and the baseline a resume sets has to be
-- remembered for as long as anything might still be published before it.
--
-- No row is inserted here. A missing row means nothing has ever been paused,
-- and the first pause or resume creates it.
CREATE TABLE `signal_tracking` (
	`id` integer PRIMARY KEY NOT NULL,
	`paused_at` integer,
	`tracking_from` integer,
	`updated_at` integer NOT NULL,
	CONSTRAINT `signal_tracking_one_row` CHECK (`id` = 1)
);
