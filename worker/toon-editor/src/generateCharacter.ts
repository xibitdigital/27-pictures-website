import type { CharacterProvider, SeriesFlowSlot, SeriesGenerateConfig } from "./apiTypes";
import { toWebp, webpDimensions } from "./imageOptimize";
import { runComfyDownload, runComfyResult, runComfySubmit } from "./runComfyClient";
import { runwareDownload, runwareResult, runwareSubmit } from "./runwareClient";
import type { Env, SeriesRow } from "./types";

/**
 * A series' character generator — text-to-image only, no reference images sent (see
 * runComfySubmit/runwareSubmit, both already treat an empty `images` array as "no refs"). Scoped
 * to a series + one of its slots rather than a toon/page like generatePage.ts's generation_jobs,
 * since a character isn't attached to any particular plate.
 */
export type CharacterJobRow = {
  id: string;
  series_key: string;
  slot_alias: string;
  provider: string;
  model: string;
  prompt: string;
  status: string;
  error: string | null;
  poll_id: string | null;
  /** Runware answers submit synchronously — the image is often already in that response. Stashed
   * here so pollCharacterJob can use it directly instead of runwareResult's getResponse poll,
   * which (per runwareClient.ts's own comment) doesn't reliably track a sync-delivered task and
   * would otherwise loop "running" forever — same fix generatePage.ts's resolvedImages already
   * applies for page generation. Always null for RunComfy (genuinely async). */
  resolved_image_url: string | null;
  file_key: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sniffImage(bytes: ArrayBuffer): { ext: string; type: string } {
  const u = new Uint8Array(bytes);
  if (u[0] === 0x89 && u[1] === 0x50) return { ext: "png", type: "image/png" };
  if (u[0] === 0xff && u[1] === 0xd8) return { ext: "jpg", type: "image/jpeg" };
  if (u[0] === 0x52 && u[1] === 0x49) return { ext: "webp", type: "image/webp" };
  return { ext: "png", type: "image/png" };
}

export async function startCharacterGenerate(
  env: Env,
  series: SeriesRow,
  generate: SeriesGenerateConfig,
  input: { prompt: string; slotAlias: string; provider: CharacterProvider; model: string }
): Promise<{ ok: true; job: CharacterJobRow } | { ok: false; error: string; status: number }> {
  let pollingId: string;
  let resolvedImageUrl: string | null = null;
  if (input.provider === "runware") {
    const submitted = await runwareSubmit(env, {
      prompt: input.prompt,
      images: [],
      model: input.model,
      width: generate.width,
      height: generate.height,
    });
    if (!submitted.ok) return { ok: false, error: submitted.error, status: 502 };
    pollingId = submitted.pollingUrl;
    resolvedImageUrl = submitted.imageUrl || null;
  } else {
    const submitted = await runComfySubmit(env, {
      prompt: input.prompt,
      images: [],
      model: input.model,
      width: generate.width,
      height: generate.height,
    });
    if (!submitted.ok) return { ok: false, error: submitted.error, status: 502 };
    pollingId = submitted.pollingUrl;
  }

  const id = crypto.randomUUID();
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO character_jobs (id, series_key, slot_alias, provider, model, prompt, status, error, poll_id, resolved_image_url, file_key, width, height, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'running', NULL, ?, ?, NULL, NULL, NULL, ?, ?)`
  )
    .bind(
      id,
      series.key,
      input.slotAlias,
      input.provider,
      input.model,
      input.prompt,
      pollingId,
      resolvedImageUrl,
      ts,
      ts
    )
    .run();
  const job = await env.DB.prepare("SELECT * FROM character_jobs WHERE id = ?").bind(id).first<CharacterJobRow>();
  if (!job) return { ok: false, error: "could not create job", status: 500 };
  return { ok: true, job };
}

async function putCharacterAsset(
  env: Env,
  seriesKey: string,
  bytes: ArrayBuffer
): Promise<{ fileKey: string; width: number | null; height: number | null }> {
  const optimized = await toWebp({ bytes, ...sniffImage(bytes) });
  const hash = await sha256Hex(optimized.bytes);
  const fileKey = `editor/_series/${seriesKey}/characters/${hash}.${optimized.ext}`;
  await env.ASSETS.put(fileKey, optimized.bytes, {
    httpMetadata: { contentType: optimized.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  const dims = optimized.ext === "webp" ? webpDimensions(optimized.bytes) : null;
  return { fileKey, width: dims?.width ?? null, height: dims?.height ?? null };
}

/**
 * Assigns a freshly generated file onto the slot that requested it, the same "find by alias, set
 * fileKey" merge the `/series/:key/refs` upload route already does — kept here so the character
 * poll route and the ref-upload route don't drift on how a slot gets its file.
 */
export function assignSlotFile(slots: SeriesFlowSlot[], alias: string, fileKey: string): SeriesFlowSlot[] {
  const existing = slots.find((slot) => slot.alias === alias);
  if (existing) {
    existing.fileKey = fileKey;
    return slots;
  }
  return [...slots, { alias, label: alias, kind: "sheet", fileKey, fileUrl: null }];
}

export async function pollCharacterJob(
  env: Env,
  job: CharacterJobRow
): Promise<
  | {
      ok: true;
      job: CharacterJobRow;
      characterId?: string;
      characterFileKey?: string;
      characterWidth?: number | null;
      characterHeight?: number | null;
      characterCreatedAt?: string;
    }
  | { ok: false; error: string; status: number }
> {
  if (job.status !== "running" || !job.poll_id) return { ok: true, job };

  const isRunware = job.provider === "runware";
  const result =
    isRunware && job.resolved_image_url
      ? { ok: true as const, phase: "done" as const, imageUrl: job.resolved_image_url }
      : isRunware
        ? await runwareResult(env, job.poll_id)
        : await runComfyResult(env, job.poll_id, []);
  if (!result.ok) {
    await env.DB.prepare(`UPDATE character_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
      .bind(result.error, nowIso(), job.id)
      .run();
    return { ok: true, job: { ...job, status: "error", error: result.error, updated_at: nowIso() } };
  }
  if (!result.imageUrl) return { ok: true, job };

  const downloaded = isRunware ? await runwareDownload(result.imageUrl) : await runComfyDownload(result.imageUrl);
  if (!downloaded.ok) {
    await env.DB.prepare(`UPDATE character_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
      .bind(downloaded.error, nowIso(), job.id)
      .run();
    return { ok: true, job: { ...job, status: "error", error: downloaded.error, updated_at: nowIso() } };
  }

  const stored = await putCharacterAsset(env, job.series_key, downloaded.bytes);
  const ts = nowIso();
  const characterId = crypto.randomUUID();
  await env.DB.prepare(
    `UPDATE character_jobs SET status = 'done', file_key = ?, width = ?, height = ?, error = NULL, updated_at = ? WHERE id = ?`
  )
    .bind(stored.fileKey, stored.width, stored.height, ts, job.id)
    .run();
  await env.DB.prepare(
    `INSERT INTO series_characters (id, series_key, prompt, file_key, width, height, provider, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      characterId,
      job.series_key,
      job.prompt,
      stored.fileKey,
      stored.width,
      stored.height,
      job.provider,
      job.model,
      ts
    )
    .run();

  return {
    ok: true,
    job: {
      ...job,
      status: "done",
      file_key: stored.fileKey,
      width: stored.width,
      height: stored.height,
      updated_at: ts,
    },
    characterId,
    characterFileKey: stored.fileKey,
    characterWidth: stored.width,
    characterHeight: stored.height,
    characterCreatedAt: ts,
  };
}
