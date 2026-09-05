-- Ordering that belongs to the reader.
--
-- Signal's shelf is a personal arrangement, not an alphabetical index: the
-- channels you check first should sit where your eye lands first, and the
-- groups should stack in the order you think about them. Neither can be
-- derived, because both are a preference rather than a fact, so both get a
-- column.
--
-- Nulls sort last and existing rows start null, which leaves today's
-- alphabetical arrangement exactly as it is until something is dragged.
ALTER TABLE `signal_channels` ADD `position` integer;
--> statement-breakpoint
CREATE INDEX `signal_channels_position_idx` ON `signal_channels` (`position`);
