CREATE TABLE series_characters (
  id TEXT PRIMARY KEY,
  series_key TEXT NOT NULL,
  prompt TEXT NOT NULL,
  file_key TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX series_characters_series_id ON series_characters (series_key, created_at DESC);

CREATE TABLE character_jobs (
  id TEXT PRIMARY KEY,
  series_key TEXT NOT NULL,
  slot_alias TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  poll_id TEXT,
  file_key TEXT,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX character_jobs_series_id ON character_jobs (series_key, created_at DESC);
