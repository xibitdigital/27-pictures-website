-- Optional border/stroke on a region's own shape (Layout mode). All three
-- default to "no border" so existing rows render exactly as today.
ALTER TABLE page_regions ADD COLUMN border_color TEXT;
ALTER TABLE page_regions ADD COLUMN border_width REAL NOT NULL DEFAULT 0;
ALTER TABLE page_regions ADD COLUMN border_style TEXT NOT NULL DEFAULT 'solid'; -- 'solid' | 'dashed' | 'dotted'
