CREATE TABLE series_editors (
  series_key TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (series_key, user_id)
);

CREATE INDEX series_editors_user_id ON series_editors (user_id);

-- Every series that already has a creator keeps them as a member so nobody
-- loses access to something they made under the old single-owner model.
INSERT INTO series_editors (series_key, user_id, created_at)
SELECT key, owner_id, COALESCE(updated_at, created_at) FROM series WHERE owner_id IS NOT NULL;
