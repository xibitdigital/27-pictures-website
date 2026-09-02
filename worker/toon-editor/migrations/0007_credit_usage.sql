-- Per-editor credit rows: audio (ElevenLabs chars) and image (Comfy jobs).
CREATE TABLE credit_usage (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  tokens     INTEGER NOT NULL,
  used_at    TEXT NOT NULL,
  source     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX credit_usage_user_kind_used ON credit_usage (user_id, kind, used_at);
