-- Per-user Runware API key, same shape as 0015_user_keys.sql.
ALTER TABLE users ADD COLUMN runware_api_token_enc TEXT;
