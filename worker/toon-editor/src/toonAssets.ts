import type { Env } from "./types";

/**
 * Records one image (a generated or uploaded plate/region file) as belonging to a toon's asset
 * gallery, independent of whatever page or region currently references it — deleting that page or
 * region, or replacing its file, never removes the row. `file_key` is content-hashed, so the same
 * image reused across pages/regions or re-generated identically dedupes onto one row (the unique
 * index on (toon_id, file_key) makes this an upsert-free INSERT OR IGNORE).
 */
export async function recordToonAsset(
  env: Pick<Env, "DB">,
  toonId: string,
  fileKey: string,
  width: number | null,
  height: number | null
): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO toon_assets (id, toon_id, file_key, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), toonId, fileKey, width, height, new Date().toISOString())
    .run();
}

export interface ToonAssetRow {
  id: string;
  toon_id: string;
  file_key: string;
  width: number | null;
  height: number | null;
  created_at: string;
}
