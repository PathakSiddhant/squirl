-- Whether the tape measure is tracked at all.
--
-- Off by default. An empty panel of measurement boxes is a suggestion that you
-- ought to be filling them in, and Form does not make suggestions like that.
ALTER TABLE `form_profile` ADD `track_measurements` integer DEFAULT 0 NOT NULL;
