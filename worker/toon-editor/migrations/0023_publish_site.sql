-- Which public catalog a series (or ungrouped toon) belongs on.
-- Grouped episodes follow the series; toons.publish_site is only consulted
-- when series_key is empty. Existing rows stay on the studio site.
ALTER TABLE series ADD COLUMN publish_site TEXT NOT NULL DEFAULT 'studio';
ALTER TABLE toons ADD COLUMN publish_site TEXT NOT NULL DEFAULT 'studio';
