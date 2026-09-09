-- Which image backend produced this job: 'comfy' (default, unchanged behaviour) | 'flux'.
-- comfy_prompt_id doubles as the Flux job id for polling when provider = 'flux'.
ALTER TABLE generation_jobs ADD COLUMN provider TEXT NOT NULL DEFAULT 'comfy';
