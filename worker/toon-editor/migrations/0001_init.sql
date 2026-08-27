CREATE TABLE toons (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL DEFAULT '',
  subtitle      TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  cover_key     TEXT,
  design_width  INTEGER NOT NULL DEFAULT 800,
  design_height INTEGER NOT NULL DEFAULT 1424,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE pages (
  id         TEXT PRIMARY KEY,
  toon_id    TEXT NOT NULL,
  position   INTEGER NOT NULL,
  file_key   TEXT NOT NULL,
  width      INTEGER,
  height     INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE (toon_id, position)
);

CREATE INDEX pages_toon_id ON pages (toon_id);

CREATE TABLE bubbles (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL,
  x          REAL NOT NULL,
  y          REAL NOT NULL,
  variant    TEXT NOT NULL DEFAULT 'bubble',
  tail       TEXT,
  size       INTEGER,
  angle      REAL,
  text_en    TEXT NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX bubbles_page_id ON bubbles (page_id);
