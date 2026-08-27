CREATE TABLE series (
  key         TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  tagline     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cover_key   TEXT,
  hub_url     TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

ALTER TABLE toons ADD COLUMN series_key TEXT;
ALTER TABLE toons ADD COLUMN episode_n INTEGER;

CREATE INDEX toons_series_key ON toons (series_key);
