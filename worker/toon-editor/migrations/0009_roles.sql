ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'editor';
ALTER TABLE users ADD COLUMN invited_by TEXT;

-- Existing accounts predate roles entirely — they keep full (admin) access.
UPDATE users SET role = 'admin';

-- Backfill so the new column is usable immediately; admin can rename later.
UPDATE users SET username = substr(email, 1, instr(email, '@') - 1) WHERE username IS NULL OR username = '';

CREATE UNIQUE INDEX users_username ON users (username);

-- Ownership for "an editor manages only series/toons they created".
-- NULL on every pre-existing row ("house-owned") — only matters for the
-- ownership check, which admins bypass unconditionally.
ALTER TABLE series ADD COLUMN owner_id TEXT;
ALTER TABLE toons ADD COLUMN owner_id TEXT;
