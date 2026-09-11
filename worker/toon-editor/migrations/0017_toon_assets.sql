-- Every plate/region image ever generated or uploaded for a toon, kept around after the page or
-- region that used it is deleted (or its image is replaced) so it can be picked again from a
-- gallery instead of re-uploading or re-generating. file_key is content-hashed, so the same image
-- reused across pages/regions dedupes onto one row via the unique index below.
CREATE TABLE toon_assets (
  id         TEXT PRIMARY KEY,
  toon_id    TEXT NOT NULL,
  file_key   TEXT NOT NULL,
  width      INTEGER,
  height     INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX toon_assets_toon_id ON toon_assets (toon_id, created_at DESC);
CREATE UNIQUE INDEX toon_assets_toon_file ON toon_assets (toon_id, file_key);
