import {
  comfyBase,
  comfyHistory,
  comfySubmitPrompt,
  comfyUploadImage,
  comfyView,
  type ComfyHistoryImage,
  type ComfyPhase,
} from "./comfyClient";
import {
  applyGeminiImagePins,
  applyLoadImages,
  applyPagePrompt,
  applyPlateSize,
  applySeed,
  matchSlotsToLoadNodes,
  normalizeSeedreamLoadOrder,
  parseGenerateConfig,
  parseGenerateCount,
  promptWithImagePins,
  type ComfyGraph,
} from "./comfyFlow";
import type { SeriesGenerateConfig } from "./apiTypes";
import { insertCreditEvent } from "./creditUsage";
import { fluxDownload, fluxResult, fluxSubmit } from "./fluxClient";
import { toWebp } from "./imageOptimize";
import type { Env, SeriesRow, ToonRow } from "./types";

export type GenerationJob = {
  id: string;
  kind: string;
  toon_id: string;
  page_id: string | null;
  region_id: string | null;
  provider: string;
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
  input: {
    toon: ToonRow;
    series: SeriesRow;
    prompt: string;
    includePrevious: boolean;
    pageId: string | null;
    /** Existing plate in this toon to use as the previous-slot reference. */
    previousPageId?: string | null;
    /** Operator-attached image for the "previous" slot. Always wins over a picked plate. */
    previousOverride?: { bytes: ArrayBuffer; type: string } | null;
    /** How many plates to run. Capped at 4; forced to 1 when replacing a page. */
    count?: number;
    /** Set when this job fills one Layout-page region instead of a whole page — pollPageJob writes the result to page_regions instead of pages. `pageId` must still be the region's owning page (forces count to 1, same as a page replace). */
    regionId?: string | null;
    /** Origin the caller is reachable from, e.g. `https://toon-editor.sangalli-marco.workers.dev`. Only used by the Flux path — BFL fetches reference images from a public URL rather than an in-Worker upload. */
    workerOrigin?: string;
    /** A series can be set to Flux, but the route decides whether this specific caller is allowed to use it — staging only. False silently falls back to Comfy (and fails with "series has no Comfy flow" if that isn't configured either), never to an error naming Flux. */
    allowFlux?: boolean;
  }
): Promise<{ ok: true; job: GenerationJob } | { ok: false; error: string; status: number }> {
  let extra: { generate?: unknown } = {};
  try {
    extra = JSON.parse(input.series.extra_json || "{}") as { generate?: unknown };
  } catch {
    extra = {};
  }
  const generate = parseGenerateConfig(extra.generate);
  if (generate.provider === "flux" && input.allowFlux) return startFluxGenerate(env, input, generate);
  if (!comfyBase(env)) return { ok: false, error: "ComfyUI is not configured", status: 503 };
  if (!generate.flowKey) return { ok: false, error: "series has no Comfy flow", status: 400 };
  const flowBytes = await getObject(env, generate.flowKey);
  if (!flowBytes) return { ok: false, error: "series flow file is missing", status: 400 };
  let graph: ComfyGraph;
  try {
    graph = normalizeSeedreamLoadOrder(JSON.parse(new TextDecoder().decode(flowBytes)) as ComfyGraph);
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
  if (input.previousPageId) {
    previousKey = pages.find((p) => p.id === input.previousPageId)?.file_key || null;
  }

  const names: (string | null)[] = [];
  const nodeIds: string[] = [];
  for (const { nodeId, slot } of matchSlotsToLoadNodes(graph, generate.slots)) {
    let bytes: ArrayBuffer | null;
    if (slot.kind === "previous" && input.previousOverride) {
      bytes = input.previousOverride.bytes;
    } else if (slot.kind === "previous" && !previousKey) {
      names.push(null);
      nodeIds.push(nodeId);
      continue;
    } else {
      const key = slot.kind === "previous" ? previousKey : slot.fileKey;
      if (!key) {
        if (slot.kind === "sheet" && slot.optional) {
          // No file and nothing required — leave this LoadImage node as-is in the graph.
          names.push(null);
          nodeIds.push(nodeId);
          continue;
        }
        return { ok: false, error: `missing reference: ${slot.label || slot.alias}`, status: 400 };
      }
      bytes = await getObject(env, key);
    }
    if (!bytes) return { ok: false, error: `missing reference file: ${slot.label || slot.alias}`, status: 400 };
    const kind = sniffImage(bytes);
    const uploaded = await comfyUploadImage(env, bytes, `${slot.alias}.${kind.ext}`);
    if (!uploaded.ok) return { ok: false, error: uploaded.error, status: 502 };
    names.push(uploaded.name);
    nodeIds.push(nodeId);
  }

  const withImages = applyLoadImages(graph, names, nodeIds);
  if (!withImages.ok) return { ok: false, error: withImages.error, status: 400 };
  let next = applyPagePrompt(
    withImages.graph,
    promptWithImagePins(input.prompt, generate.slots),
    generate.promptTarget
  );
  next = applyGeminiImagePins(next, generate.slots);
  next = applyPlateSize(next, generate.width, generate.height);

  const count = input.pageId ? 1 : parseGenerateCount(input.count);
  const baseSeed = crypto.getRandomValues(new Uint32Array(1))[0] % 2_147_483_647;
  const promptIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const submitted = await comfySubmitPrompt(env, applySeed(next, (baseSeed + i) % 2_147_483_647));
    if (!submitted.ok) return { ok: false, error: submitted.error, status: 502 };
    promptIds.push(submitted.promptId);
  }

  const id = crypto.randomUUID();
  const ts = nowIso();
  const regionId = input.regionId || null;
  await env.DB.prepare(
    `INSERT INTO generation_jobs (id, kind, toon_id, page_id, region_id, provider, status, prompt, payload_json, error, result_page_id, comfy_prompt_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'comfy', 'running', ?, ?, NULL, NULL, ?, ?, ?)`
  )
    .bind(
      id,
      regionId ? "region" : "page",
      input.toon.id,
      input.pageId,
      regionId,
      input.prompt,
      JSON.stringify({
        includePrevious: input.includePrevious,
        previousPageId: input.previousPageId || null,
        names,
        nodeIds,
        width: generate.width,
        height: generate.height,
        count,
        promptIds,
      }),
      promptIds[0],
      ts,
      ts
    )
    .run();
  const job = await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?").bind(id).first<GenerationJob>();
  if (!job) return { ok: false, error: "could not create job", status: 500 };
  return { ok: true, job };
}

/** Reference image bytes need a public URL for BFL to fetch — same content-addressed key scheme as putPlate, just skipping the WebP re-encode since this is an input, not a stored plate. */
async function putRefAsset(env: Env, slug: string, bytes: ArrayBuffer, type: string): Promise<string> {
  const kind = sniffImage(bytes);
  const ext = type === "image/webp" ? "webp" : kind.ext;
  const hash = await sha256Hex(bytes);
  const key = `editor/${slug}/assets/${hash}.${ext}`;
  await env.ASSETS.put(key, bytes, { httpMetadata: { contentType: type || kind.type } });
  return key;
}

/**
 * Flux.2 [pro] takes a prompt plus up to 8 reference images by public URL —
 * no graph, no LoadImage nodes, no per-node upload. Reuses the series's
 * existing `generate.slots` purely as an ordered reference list (sheets +
 * previous plate), and reuses the same generation_jobs bookkeeping so
 * pollPageJob's page/region-write logic doesn't need to know which provider
 * ran. Staging-only is enforced by the caller (index.ts), not here.
 */
async function startFluxGenerate(
  env: Env,
  input: Parameters<typeof startPageGenerate>[1],
  generate: SeriesGenerateConfig
): Promise<{ ok: true; job: GenerationJob } | { ok: false; error: string; status: number }> {
  const origin = (input.workerOrigin || "").replace(/\/$/, "");
  if (!origin) return { ok: false, error: "missing worker origin for Flux reference URLs", status: 500 };

  const pages = (
    await env.DB.prepare("SELECT * FROM pages WHERE toon_id = ? ORDER BY position ASC").bind(input.toon.id).all<{
      id: string;
      file_key: string;
    }>()
  ).results;
  let previousKey: string | null = null;
  if (input.previousPageId) {
    previousKey = pages.find((p) => p.id === input.previousPageId)?.file_key || null;
  }

  const images: string[] = [];
  for (const slot of generate.slots) {
    let key: string | null;
    if (slot.kind === "previous" && input.previousOverride) {
      key = await putRefAsset(env, input.toon.slug, input.previousOverride.bytes, input.previousOverride.type);
    } else if (slot.kind === "previous") {
      key = previousKey;
      if (!key) continue;
    } else {
      key = slot.fileKey || null;
      if (!key) {
        if (slot.optional) continue;
        return { ok: false, error: `missing reference: ${slot.label || slot.alias}`, status: 400 };
      }
    }
    images.push(`${origin}/media/${key}`);
  }
  if (images.length > 8) images.length = 8; // flux-2-pro's own cap; extra sheets are dropped, not an error

  const count = input.pageId ? 1 : parseGenerateCount(input.count);
  const baseSeed = crypto.getRandomValues(new Uint32Array(1))[0] % 2_147_483_647;
  const promptIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const submitted = await fluxSubmit(env, {
      prompt: input.prompt,
      images,
      width: generate.width,
      height: generate.height,
      seed: (baseSeed + i) % 2_147_483_647,
    });
    if (!submitted.ok) return { ok: false, error: submitted.error, status: 502 };
    // Stored (and later polled) as the full pollingUrl, not the bare id — see fluxResult's comment.
    promptIds.push(submitted.pollingUrl);
  }

  const id = crypto.randomUUID();
  const ts = nowIso();
  const regionId = input.regionId || null;
  await env.DB.prepare(
    `INSERT INTO generation_jobs (id, kind, toon_id, page_id, region_id, provider, status, prompt, payload_json, error, result_page_id, comfy_prompt_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'flux', 'running', ?, ?, NULL, NULL, ?, ?, ?)`
  )
    .bind(
      id,
      regionId ? "region" : "page",
      input.toon.id,
      input.pageId,
      regionId,
      input.prompt,
      JSON.stringify({
        includePrevious: input.includePrevious,
        previousPageId: input.previousPageId || null,
        width: generate.width,
        height: generate.height,
        count,
        promptIds,
      }),
      promptIds[0],
      ts,
      ts
    )
    .run();
  const job = await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?").bind(id).first<GenerationJob>();
  if (!job) return { ok: false, error: "could not create job", status: 500 };
  return { ok: true, job };
}

function promptIdsFromJob(job: GenerationJob): string[] {
  try {
    const payload = JSON.parse(job.payload_json) as { promptIds?: unknown };
    if (Array.isArray(payload.promptIds)) {
      const ids = payload.promptIds.filter((id): id is string => typeof id === "string" && Boolean(id));
      if (ids.length) return ids;
    }
  } catch {
    /* fall through */
  }
  return job.comfy_prompt_id ? [job.comfy_prompt_id] : [];
}

export function generateCountFromJob(job: GenerationJob): number {
  try {
    return parseGenerateCount((JSON.parse(job.payload_json) as { count?: unknown }).count);
  } catch {
    return 1;
  }
}

function pickOutputImage(images: ComfyHistoryImage[]): ComfyHistoryImage {
  return images.find((img) => (img.type || "output") === "output") || images[0];
}

function plateSizeFromJob(job: GenerationJob): { width: number | null; height: number | null } {
  try {
    const payload = JSON.parse(job.payload_json) as { width?: unknown; height?: unknown };
    const w = Number(payload.width);
    const h = Number(payload.height);
    return {
      width: Number.isFinite(w) && w > 0 ? Math.round(w) : null,
      height: Number.isFinite(h) && h > 0 ? Math.round(h) : null,
    };
  } catch {
    return { width: null, height: null };
  }
}

async function putPlate(
  env: Env,
  toon: ToonRow,
  bytes: ArrayBuffer
): Promise<{ fileKey: string; ext: string; type: string }> {
  const optimized = await toWebp({ bytes, ...sniffImage(bytes) });
  const hash = await sha256Hex(optimized.bytes);
  const fileKey = `editor/${toon.slug}/assets/${hash}.${optimized.ext}`;
  await env.ASSETS.put(fileKey, optimized.bytes, {
    httpMetadata: { contentType: optimized.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return { fileKey, ext: optimized.ext, type: optimized.type };
}

export async function pollPageJob(
  env: Env,
  job: GenerationJob,
  toon: ToonRow
): Promise<{ ok: true; job: GenerationJob; phase: ComfyPhase | null } | { ok: false; error: string; status: number }> {
  const promptIds = promptIdsFromJob(job);
  if (job.status !== "running" || !promptIds.length) {
    return { ok: true, job, phase: job.status === "done" ? "done" : null };
  }

  const isFlux = job.provider === "flux";
  const outputs: (ComfyHistoryImage | string)[] = []; // string = Flux's signed sample URL
  let phase: ComfyPhase | null = null;
  for (const promptId of promptIds) {
    if (isFlux) {
      // For Flux, promptId is actually the full pollingUrl stored at submit time.
      const result = await fluxResult(env, promptId);
      if (!result.ok) {
        await env.DB.prepare(`UPDATE generation_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
          .bind(result.error, nowIso(), job.id)
          .run();
        return {
          ok: true,
          job: { ...job, status: "error", error: result.error, updated_at: nowIso() },
          phase: "error",
        };
      }
      if (!result.imageUrl) return { ok: true, job, phase: result.phase };
      outputs.push(result.imageUrl);
      phase = result.phase;
      continue;
    }
    const hist = await comfyHistory(env, promptId);
    if (!hist.ok) {
      await env.DB.prepare(`UPDATE generation_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
        .bind(hist.error, nowIso(), job.id)
        .run();
      return { ok: true, job: { ...job, status: "error", error: hist.error, updated_at: nowIso() }, phase: "error" };
    }
    if (hist.pending || !hist.images.length) {
      const waiting = hist.phase === "queued" || phase === "queued" ? "queued" : hist.phase;
      return { ok: true, job, phase: waiting };
    }
    outputs.push(pickOutputImage(hist.images));
    phase = hist.phase;
  }

  const fresh = await env.DB.prepare("SELECT status FROM generation_jobs WHERE id = ?")
    .bind(job.id)
    .first<{ status: string }>();
  if (fresh && fresh.status !== "running") {
    const latest = await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?")
      .bind(job.id)
      .first<GenerationJob>();
    return { ok: true, job: latest || job, phase: latest?.status === "done" ? "done" : phase };
  }

  const plates: string[] = [];
  for (const image of outputs) {
    if (isFlux) {
      const downloaded = await fluxDownload(image as string);
      if (!downloaded.ok) {
        await env.DB.prepare(`UPDATE generation_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
          .bind(downloaded.error, nowIso(), job.id)
          .run();
        return { ok: true, job: { ...job, status: "error", error: downloaded.error }, phase: "error" };
      }
      // Flux was asked for output_format: "webp" — store as-is, skip toWebp's decode/encode entirely.
      const hash = await sha256Hex(downloaded.bytes);
      const fileKey = `editor/${toon.slug}/assets/${hash}.webp`;
      await env.ASSETS.put(fileKey, downloaded.bytes, {
        httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
      });
      plates.push(fileKey);
      continue;
    }
    const viewed = await comfyView(env, image as ComfyHistoryImage);
    if (!viewed.ok) {
      await env.DB.prepare(`UPDATE generation_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
        .bind(viewed.error, nowIso(), job.id)
        .run();
      return { ok: true, job: { ...job, status: "error", error: viewed.error }, phase: "error" };
    }
    const stored = await putPlate(env, toon, viewed.bytes);
    plates.push(stored.fileKey);
  }

  const { width, height } = plateSizeFromJob(job);
  let resultPageId = job.page_id;
  for (let i = 0; i < plates.length; i++) {
    const fileKey = plates[i];
    if (i === 0 && job.region_id) {
      // Fills one Layout-page region, never the page's own plate — the
      // editor flattens regions onto the page separately. Skips the
      // "first plate sets toon design size" backfill below entirely, since
      // that heuristic is only meaningful for a toon's very first whole page.
      await env.DB.prepare(
        `UPDATE page_regions SET file_key = ?, file_width = COALESCE(?, file_width), file_height = COALESCE(?, file_height), image_offset_x = 0.5, image_offset_y = 0.5, image_scale = 1, updated_at = ? WHERE id = ?`
      )
        .bind(fileKey, width, height, nowIso(), job.region_id)
        .run();
      continue;
    }
    if (i === 0 && job.page_id) {
      await env.DB.prepare(
        `UPDATE pages SET file_key = ?, width = COALESCE(?, width), height = COALESCE(?, height) WHERE id = ?`
      )
        .bind(fileKey, width, height, job.page_id)
        .run();
      continue;
    }
    const posRow = await env.DB.prepare("SELECT COALESCE(MAX(position), -1) AS max_pos FROM pages WHERE toon_id = ?")
      .bind(toon.id)
      .first<{ max_pos: number }>();
    const position = (posRow && Number(posRow.max_pos) > -1 ? Number(posRow.max_pos) : -1) + 1;
    const pageId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO pages (id, toon_id, position, file_key, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(pageId, toon.id, position, fileKey, width, height, nowIso())
      .run();
    resultPageId = pageId;
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
    phase: "done",
  };
}

export async function recordImageCredit(env: Env, userId: string, tokens = 1): Promise<void> {
  await insertCreditEvent(env, {
    userId,
    kind: "image",
    tokens: Math.max(1, Math.round(tokens)),
    source: "comfy-generate",
  });
}
