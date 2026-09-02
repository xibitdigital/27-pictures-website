import { comfyBase, comfyHistory, comfySubmitPrompt, comfyUploadImage, comfyView } from "./comfyClient";
import { applyLoadImages, applyPagePrompt, applyPlateSize, parseGenerateConfig, type ComfyGraph } from "./comfyFlow";
import { insertCreditEvent } from "./creditUsage";
import { toWebp } from "./imageOptimize";
import type { Env, SeriesRow, ToonRow } from "./types";

export type GenerationJob = {
  id: string;
  kind: string;
  toon_id: string;
  page_id: string | null;
  status: string;
  prompt: string;
  payload_json: string;
  error: string | null;
  result_page_id: string | null;
  comfy_prompt_id: string | null;
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

async function getObject(env: Env, key: string): Promise<ArrayBuffer | null> {
  const obj = await env.ASSETS.get(key);
  if (!obj) return null;
  return obj.arrayBuffer();
}

export async function startPageGenerate(
  env: Env,
  input: { toon: ToonRow; series: SeriesRow; prompt: string; includePrevious: boolean; pageId: string | null }
): Promise<{ ok: true; job: GenerationJob } | { ok: false; error: string; status: number }> {
  if (!comfyBase(env)) return { ok: false, error: "ComfyUI is not configured", status: 503 };
  let extra: { generate?: unknown } = {};
  try {
    extra = JSON.parse(input.series.extra_json || "{}") as { generate?: unknown };
  } catch {
    extra = {};
  }
  const generate = parseGenerateConfig(extra.generate);
  if (!generate.flowKey) return { ok: false, error: "series has no Comfy flow", status: 400 };
  const flowBytes = await getObject(env, generate.flowKey);
  if (!flowBytes) return { ok: false, error: "series flow file is missing", status: 400 };
  let graph: ComfyGraph;
  try {
    graph = JSON.parse(new TextDecoder().decode(flowBytes)) as ComfyGraph;
  } catch {
    return { ok: false, error: "series flow is not valid JSON", status: 400 };
  }

  const pages = (
    await env.DB.prepare("SELECT * FROM pages WHERE toon_id = ? ORDER BY position ASC").bind(input.toon.id).all<{
      id: string;
      file_key: string;
    }>()
  ).results;
  let previousKey: string | null = null;
  if (input.includePrevious) {
    if (input.pageId) {
      previousKey = pages.find((p) => p.id === input.pageId)?.file_key || null;
    } else {
      previousKey = pages.length ? pages[pages.length - 1].file_key : null;
    }
  }

  const names: string[] = [];
  for (const slot of generate.slots) {
    const key = slot.kind === "previous" ? previousKey : slot.fileKey;
    if (!key) {
      return { ok: false, error: `missing reference: ${slot.label || slot.alias}`, status: 400 };
    }
    const bytes = await getObject(env, key);
    if (!bytes) return { ok: false, error: `missing reference file: ${slot.label || slot.alias}`, status: 400 };
    const kind = sniffImage(bytes);
    const uploaded = await comfyUploadImage(env, bytes, `${slot.alias}.${kind.ext}`);
    if (!uploaded.ok) return { ok: false, error: uploaded.error, status: 502 };
    names.push(uploaded.name);
  }

  const withImages = applyLoadImages(graph, names);
  if (!withImages.ok) return { ok: false, error: withImages.error, status: 400 };
  let next = applyPagePrompt(withImages.graph, input.prompt, generate.promptTarget);
  next = applyPlateSize(next, generate.width, generate.height);

  const submitted = await comfySubmitPrompt(env, next);
  if (!submitted.ok) return { ok: false, error: submitted.error, status: 502 };

  const id = crypto.randomUUID();
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO generation_jobs (id, kind, toon_id, page_id, status, prompt, payload_json, error, result_page_id, comfy_prompt_id, created_at, updated_at)
     VALUES (?, 'page', ?, ?, 'running', ?, ?, NULL, NULL, ?, ?, ?)`
  )
    .bind(
      id,
      input.toon.id,
      input.pageId,
      input.prompt,
      JSON.stringify({
        includePrevious: input.includePrevious,
        names,
        width: generate.width,
        height: generate.height,
      }),
      submitted.promptId,
      ts,
      ts
    )
    .run();
  const job = await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?").bind(id).first<GenerationJob>();
  if (!job) return { ok: false, error: "could not create job", status: 500 };
  return { ok: true, job };
}

export async function pollPageJob(
  env: Env,
  job: GenerationJob,
  toon: ToonRow
): Promise<{ ok: true; job: GenerationJob } | { ok: false; error: string; status: number }> {
  if (job.status !== "running" || !job.comfy_prompt_id) return { ok: true, job };
  const hist = await comfyHistory(env, job.comfy_prompt_id);
  if (!hist.ok) {
    await env.DB.prepare(`UPDATE generation_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
      .bind(hist.error, nowIso(), job.id)
      .run();
    return { ok: true, job: { ...job, status: "error", error: hist.error, updated_at: nowIso() } };
  }
  if (hist.pending || !hist.images.length) return { ok: true, job };

  const fresh = await env.DB.prepare("SELECT status FROM generation_jobs WHERE id = ?")
    .bind(job.id)
    .first<{ status: string }>();
  if (fresh && fresh.status !== "running") {
    const latest = await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?")
      .bind(job.id)
      .first<GenerationJob>();
    return { ok: true, job: latest || job };
  }

  const image = hist.images.find((img) => (img.type || "output") === "output") || hist.images[0];
  const viewed = await comfyView(env, image);
  if (!viewed.ok) {
    await env.DB.prepare(`UPDATE generation_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
      .bind(viewed.error, nowIso(), job.id)
      .run();
    return { ok: true, job: { ...job, status: "error", error: viewed.error } };
  }
  const optimized = await toWebp({ bytes: viewed.bytes, ...sniffImage(viewed.bytes) });
  const hash = await sha256Hex(optimized.bytes);
  const fileKey = `editor/${toon.slug}/assets/${hash}.${optimized.ext}`;
  await env.ASSETS.put(fileKey, optimized.bytes, {
    httpMetadata: { contentType: optimized.type, cacheControl: "public, max-age=31536000, immutable" },
  });

  let resultPageId = job.page_id;
  let width: number | null = null;
  let height: number | null = null;
  try {
    const payload = JSON.parse(job.payload_json) as { width?: unknown; height?: unknown };
    const w = Number(payload.width);
    const h = Number(payload.height);
    width = Number.isFinite(w) && w > 0 ? Math.round(w) : null;
    height = Number.isFinite(h) && h > 0 ? Math.round(h) : null;
  } catch {
    /* keep null */
  }
  if (job.page_id) {
    await env.DB.prepare(
      `UPDATE pages SET file_key = ?, width = COALESCE(?, width), height = COALESCE(?, height) WHERE id = ?`
    )
      .bind(fileKey, width, height, job.page_id)
      .run();
  } else {
    const posRow = await env.DB.prepare("SELECT COALESCE(MAX(position), -1) AS max_pos FROM pages WHERE toon_id = ?")
      .bind(toon.id)
      .first<{ max_pos: number }>();
    const position = (posRow && Number(posRow.max_pos) > -1 ? Number(posRow.max_pos) : -1) + 1;
    resultPageId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO pages (id, toon_id, position, file_key, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(resultPageId, toon.id, position, fileKey, width, height, nowIso())
      .run();
    const stillDefault = toon.design_width === 800 && toon.design_height === 1424;
    if (stillDefault && width && height && position === 0) {
      await env.DB.prepare(`UPDATE toons SET design_width = ?, design_height = ?, updated_at = ? WHERE id = ?`)
        .bind(width, height, nowIso(), toon.id)
        .run();
    }
  }
  await env.DB.prepare(`UPDATE toons SET updated_at = ? WHERE id = ?`).bind(nowIso(), toon.id).run();
  await env.DB.prepare(
    `UPDATE generation_jobs SET status = 'done', result_page_id = ?, error = NULL, updated_at = ? WHERE id = ?`
  )
    .bind(resultPageId, nowIso(), job.id)
    .run();
  return {
    ok: true,
    job: { ...job, status: "done", result_page_id: resultPageId, error: null, updated_at: nowIso() },
  };
}

export async function recordImageCredit(env: Env, userId: string): Promise<void> {
  await insertCreditEvent(env, { userId, kind: "image", tokens: 1, source: "comfy-generate" });
}
