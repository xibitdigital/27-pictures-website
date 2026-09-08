-- pages.kind: 'plate' (today's single-image pages) | 'layout' (regions editor).
ALTER TABLE pages ADD COLUMN kind TEXT NOT NULL DEFAULT 'plate';

CREATE TABLE page_regions (
  id             TEXT PRIMARY KEY,
  page_id        TEXT NOT NULL,
  shape_type     TEXT NOT NULL DEFAULT 'rect',   -- 'rect' | 'polygon'
  geometry_json  TEXT NOT NULL,                  -- plate-fraction coords
  file_key       TEXT,                           -- null until an image is assigned
  file_width     INTEGER,
  file_height    INTEGER,
  image_offset_x REAL NOT NULL DEFAULT 0.5,
  image_offset_y REAL NOT NULL DEFAULT 0.5,
  image_scale    REAL NOT NULL DEFAULT 1,
  sort           INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX page_regions_page_id ON page_regions (page_id);

-- Lets a generation job target one region's image instead of a whole page.
ALTER TABLE generation_jobs ADD COLUMN region_id TEXT;
