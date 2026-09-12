-- Per-user RunComfy API key, same shape as 0016_runware_key.sql. RunComfy is a distinct service
-- from the self-hosted ComfyUI this Worker also talks to (COMFY_URL/comfy_api_key_enc) — same
-- "Comfy" name, different provider, hence the separate column instead of reusing that one.
ALTER TABLE users ADD COLUMN runcomfy_api_token_enc TEXT;
