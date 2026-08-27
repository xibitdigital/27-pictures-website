CREATE TABLE toon_likes (
  toon  TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE toon_like_votes (
  toon       TEXT NOT NULL,
  ip_hash    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (toon, ip_hash)
);
