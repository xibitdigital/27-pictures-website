ALTER TABLE toons ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE toons ADD COLUMN reader_url TEXT;
ALTER TABLE toons ADD COLUMN asset_page_dir TEXT;
ALTER TABLE toons ADD COLUMN extra_json TEXT;

ALTER TABLE bubbles ADD COLUMN text_json TEXT;
ALTER TABLE bubbles ADD COLUMN extra_json TEXT;
