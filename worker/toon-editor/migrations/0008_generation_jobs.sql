CREATE TABLE generation_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  toon_id TEXT NOT NULL,
  page_id TEXT,
  status TEXT NOT NULL,
  prompt TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  error TEXT,
  result_page_id TEXT,
  comfy_prompt_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX generation_jobs_toon ON generation_jobs (toon_id, created_at);
