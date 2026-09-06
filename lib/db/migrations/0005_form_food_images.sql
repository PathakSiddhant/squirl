-- A picture for a food, stored inline.
--
-- Nullable, because most foods will never have one and an empty string would
-- be a second way of saying null. See `formFoods.image` for why the bytes live
-- in the row rather than on disk or behind a URL.
ALTER TABLE `form_foods` ADD `image` text;
