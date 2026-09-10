-- Per-user API keys, encrypted at rest (AES-GCM, see userKeys.ts). NULL means
-- "not set" — generation falls back to the shared Worker secret. `created_by`
-- on generation_jobs records whose key set a job used, so pollPageJob can
-- resolve the same key later regardless of who's viewing the job.
-- No bfl_api_key column: BFL has no per-user proxying and the provider is
-- being removed from this editor soon regardless.
ALTER TABLE users ADD COLUMN replicate_api_token_enc TEXT;
ALTER TABLE users ADD COLUMN comfy_api_key_enc TEXT;
ALTER TABLE users ADD COLUMN elevenlabs_api_key_enc TEXT;

ALTER TABLE generation_jobs ADD COLUMN created_by TEXT;
