-- Editor-set backdrop color for a page (Layout mode) — null means the
-- existing default background, not stored as a specific color.
ALTER TABLE pages ADD COLUMN bg_color TEXT;
