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
import { toWebp, webpDimensions } from "./imageOptimize";
import { replicateDownload, replicateResult, replicateSubmit, type ReplicateKind } from "./replicateClient";
import { runwareDownload, runwareResult, runwareSubmit } from "./runwareClient";
import { recordToonAsset } from "./toonAssets";
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
  /** Who started this job — pollPageJob resolves this user's saved API keys (userKeys.ts) so a later poll (possibly by someone else viewing the same toon) still uses the key the job was actually submitted with. */
  created_by: string | null;
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

/**
 * Resolves the "previous" slot's source file — either a whole plate
 * (`previousPageId`, the page's own flattened composite) or one shape's own
 * image inside a layout page (`previousRegionId`, that region's file only,
 * never the page's flattened composite). `previousRegionId` wins when both
 * are somehow set. Both are scoped to this toon so a stale id from another
 * toon can't leak its file.
 */
async function resolvePreviousKey(
  env: Env,
  toonId: string,
  input: { previousPageId?: string | null; previousRegionId?: string | null }
): Promise<string | null> {
  if (input.previousRegionId) {
    const region = await env.DB.prepare(
      `SELECT page_regions.file_key AS file_key
       FROM page_regions
       INNER JOIN pages ON pages.id = page_regions.page_id
       WHERE page_regions.id = ? AND pages.toon_id = ?`
    )
      .bind(input.previousRegionId, toonId)
      .first<{ file_key: string | null }>();
    return region?.file_key || null;
  }
  if (input.previousPageId) {
    const page = await env.DB.prepare("SELECT file_key FROM pages WHERE id = ? AND toon_id = ?")
      .bind(input.previousPageId, toonId)
      .first<{ file_key: string | null }>();
    return page?.file_key || null;
  }
  return null;
}

export async function startPageGenerate(
  env: Env,
  input: {
    toon: ToonRow;
    series: SeriesRow;
    prompt: string;
    includePrevious: boolean;
    pageId: string | null;
    /** Existing plate in this toon to use as the previous-slot reference. Ignored when `previousRegionId` is set. */
    previousPageId?: string | null;
    /** One shape's own image inside a layout page in this toon, used as the previous-slot reference instead of a whole plate. */
    previousRegionId?: string | null;
    /** Operator-attached image for the "previous" slot. Always wins over a picked plate. */
    previousOverride?: { bytes: ArrayBuffer; type: string } | null;
    /** How many plates to run. Capped at 4; forced to 1 when replacing a page. */
    count?: number;
    /** Set when this job fills one Layout-page region instead of a whole page — pollPageJob writes the result to page_regions instead of pages. `pageId` must still be the region's owning page (forces count to 1, same as a page replace). */
    regionId?: string | null;
    /** Origin the caller is reachable from, e.g. `https://toon-editor.sangalli-marco.workers.dev`. Only used by the Flux path — BFL fetches reference images from a public URL rather than an in-Worker upload. */
    workerOrigin?: string;
    /** Flux only — sheet aliases to leave out of this one call. Ignored by the Comfy path, whose LoadImage nodes are fixed to the graph. */
    excludeAliases?: string[];
    /**
     * A region fill's own pixel size on the page, not the whole plate's
     * design size. Generating at full-plate resolution and downscaling to
     * fit a small panel is how a fill ends up visibly softer than the plate
     * it's dropped into — generating at (near) the panel's own size instead
     * needs little to no resampling on composite. Falls back to the series'
     * design width/height for a whole-page generation (no regionId).
     */
    targetWidth?: number;
    targetHeight?: number;
    /** The user who started this job — stored on the row so a later poll resolves the same saved API keys (see GenerationJob.created_by). */
    createdBy?: string | null;
  }
): Promise<{ ok: true; job: GenerationJob } | { ok: false; error: string; status: number }> {
  let extra: { generate?: unknown } = {};
  try {
    extra = JSON.parse(input.series.extra_json || "{}") as { generate?: unknown };
  } catch {
    extra = {};
  }
  const generate = parseGenerateConfig(extra.generate);
  const targetWidth = input.targetWidth ?? generate.width;
  const targetHeight = input.targetHeight ?? generate.height;
  if (generate.provider === "flux") return startFluxGenerate(env, input, generate);
  if (generate.provider === "replicate-flux" || generate.provider === "replicate-seedream") {
    return startReplicateGenerate(env, input, generate, generate.provider);
  }
  if (generate.provider === "runware") return startRunwareGenerate(env, input, generate);
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

  const previousKey = await resolvePreviousKey(env, input.toon.id, input);

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
  next = applyPlateSize(next, targetWidth, targetHeight);

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
    `INSERT INTO generation_jobs (id, kind, toon_id, page_id, region_id, provider, status, prompt, payload_json, error, result_page_id, comfy_prompt_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'comfy', 'running', ?, ?, NULL, NULL, ?, ?, ?, ?)`
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
        width: targetWidth,
        height: targetHeight,
        count,
        promptIds,
      }),
      promptIds[0],
      input.createdBy || null,
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
 * ran.
 */
async function startFluxGenerate(
  env: Env,
  input: Parameters<typeof startPageGenerate>[1],
  generate: SeriesGenerateConfig
): Promise<{ ok: true; job: GenerationJob } | { ok: false; error: string; status: number }> {
  const origin = (input.workerOrigin || "").replace(/\/$/, "");
  if (!origin) return { ok: false, error: "missing worker origin for Flux reference URLs", status: 500 };
  const targetWidth = input.targetWidth ?? generate.width;
  const targetHeight = input.targetHeight ?? generate.height;

  const previousKey = await resolvePreviousKey(env, input.toon.id, input);

  const excluded = new Set(input.excludeAliases || []);
  const images: string[] = [];
  for (const slot of generate.slots) {
    if (excluded.has(slot.alias)) continue; // wins over "required" — this is a per-call opt-out, not a series config change
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
      width: targetWidth,
      height: targetHeight,
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
    `INSERT INTO generation_jobs (id, kind, toon_id, page_id, region_id, provider, status, prompt, payload_json, error, result_page_id, comfy_prompt_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'flux', 'running', ?, ?, NULL, NULL, ?, ?, ?, ?)`
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
        width: targetWidth,
        height: targetHeight,
        count,
        promptIds,
      }),
      promptIds[0],
      input.createdBy || null,
      ts,
      ts
    )
    .run();
  const job = await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?").bind(id).first<GenerationJob>();
  if (!job) return { ok: false, error: "could not create job", status: 500 };
  return { ok: true, job };
}

/**
 * Same reference-sheets pipeline as startFluxGenerate, routed through
 * Replicate instead of BFL directly. "replicate-flux" (Flux Kontext's
 * multi-image variant) only accepts 2 reference images — replicateSubmit
 * itself caps the list, so the truncation always picks the first 2
 * non-excluded slots in series-config order (typically identity + previous
 * page); "replicate-seedream" keeps the same 8-image cap the other
 * providers use.
 */
async function startReplicateGenerate(
  env: Env,
  input: Parameters<typeof startPageGenerate>[1],
  generate: SeriesGenerateConfig,
  kind: ReplicateKind
): Promise<{ ok: true; job: GenerationJob } | { ok: false; error: string; status: number }> {
  const origin = (input.workerOrigin || "").replace(/\/$/, "");
  if (!origin) return { ok: false, error: "missing worker origin for Replicate reference URLs", status: 500 };
  const targetWidth = input.targetWidth ?? generate.width;
  const targetHeight = input.targetHeight ?? generate.height;

  const previousKey = await resolvePreviousKey(env, input.toon.id, input);

  const excluded = new Set(input.excludeAliases || []);
  const images: string[] = [];
  for (const slot of generate.slots) {
    if (excluded.has(slot.alias)) continue;
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

  const count = input.pageId ? 1 : parseGenerateCount(input.count);
  const promptIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const submitted = await replicateSubmit(env, kind, {
      prompt: input.prompt,
      images,
      width: targetWidth,
      height: targetHeight,
    });
    if (!submitted.ok) return { ok: false, error: submitted.error, status: 502 };
    // Stored (and later polled) as the full polling URL (urls.get), not the bare id.
    promptIds.push(submitted.pollingUrl);
  }

  const id = crypto.randomUUID();
  const ts = nowIso();
  const regionId = input.regionId || null;
  await env.DB.prepare(
    `INSERT INTO generation_jobs (id, kind, toon_id, page_id, region_id, provider, status, prompt, payload_json, error, result_page_id, comfy_prompt_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, NULL, NULL, ?, ?, ?, ?)`
  )
    .bind(
      id,
      regionId ? "region" : "page",
      input.toon.id,
      input.pageId,
      regionId,
      kind,
      input.prompt,
      JSON.stringify({
        includePrevious: input.includePrevious,
        previousPageId: input.previousPageId || null,
        width: targetWidth,
        height: targetHeight,
        count,
        promptIds,
      }),
      promptIds[0],
      input.createdBy || null,
      ts,
      ts
    )
    .run();
  const job = await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?").bind(id).first<GenerationJob>();
  if (!job) return { ok: false, error: "could not create job", status: 500 };
  return { ok: true, job };
}

/**
 * Same reference-sheets pipeline as startFluxGenerate/startReplicateGenerate,
 * routed through Runware's single `imageInference` endpoint. Unlike the
 * Replicate providers there's no fixed kind/model per call — the series'
 * `generate.model` names whichever Runware model id to hit (see
 * runwareClient.ts's module comment for why).
 */
async function startRunwareGenerate(
  env: Env,
  input: Parameters<typeof startPageGenerate>[1],
  generate: SeriesGenerateConfig
): Promise<{ ok: true; job: GenerationJob } | { ok: false; error: string; status: number }> {
  const origin = (input.workerOrigin || "").replace(/\/$/, "");
  if (!origin) return { ok: false, error: "missing worker origin for Runware reference URLs", status: 500 };
  const targetWidth = input.targetWidth ?? generate.width;
  const targetHeight = input.targetHeight ?? generate.height;

  const previousKey = await resolvePreviousKey(env, input.toon.id, input);

  const excluded = new Set(input.excludeAliases || []);
  const images: string[] = [];
  for (const slot of generate.slots) {
    if (excluded.has(slot.alias)) continue;
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

  const count = input.pageId ? 1 : parseGenerateCount(input.count);
  const promptIds: string[] = [];
  // Runware answers the submit call synchronously (no deliveryMethod: "async" is set) — the image
  // is already in that response when ready. Stash it so pollPageJob can use it directly instead of
  // polling getResponse, which doesn't reliably track a sync-delivered task (see runwareClient.ts).
  const resolvedImages: (string | null)[] = [];
  for (let i = 0; i < count; i++) {
    const submitted = await runwareSubmit(env, {
      // No server-side "Image N = label" legend here — the operator's own prompt (built client-side
      // in GeneratePageDialog.vue's fluxRefsPrefill, shared by every direct provider) already carries
      // one. A second, server-added legend here only duplicated it.
      prompt: input.prompt,
      images,
      model: generate.model,
      width: targetWidth,
      height: targetHeight,
    });
    if (!submitted.ok) return { ok: false, error: submitted.error, status: 502 };
    // Stored (and later polled) as the taskUUID — Runware has no per-job "get" URL.
    promptIds.push(submitted.pollingUrl);
    resolvedImages.push(submitted.imageUrl || null);
  }

  const id = crypto.randomUUID();
  const ts = nowIso();
  const regionId = input.regionId || null;
  await env.DB.prepare(
    `INSERT INTO generation_jobs (id, kind, toon_id, page_id, region_id, provider, status, prompt, payload_json, error, result_page_id, comfy_prompt_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'runware', 'running', ?, ?, NULL, NULL, ?, ?, ?, ?)`
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
        width: targetWidth,
        height: targetHeight,
        count,
        promptIds,
        resolvedImages,
      }),
      promptIds[0],
      input.createdBy || null,
      ts,
      ts
    )
    .run();
  const job = await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?").bind(id).first<GenerationJob>();
  if (!job) return { ok: false, error: "could not create job", status: 500 };
  return { ok: true, job };
}

function resolvedImagesFromJob(job: GenerationJob): (string | null)[] {
  try {
    const payload = JSON.parse(job.payload_json) as { resolvedImages?: unknown };
    if (Array.isArray(payload.resolvedImages)) {
      return payload.resolvedImages.map((v) => (typeof v === "string" && v ? v : null));
    }
  } catch {
    /* fall through */
  }
  return [];
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
): Promise<{ fileKey: string; ext: string; type: string; width: number | null; height: number | null }> {
  const optimized = await toWebp({ bytes, ...sniffImage(bytes) });
  const hash = await sha256Hex(optimized.bytes);
  const fileKey = `editor/${toon.slug}/assets/${hash}.${optimized.ext}`;
  await env.ASSETS.put(fileKey, optimized.bytes, {
    httpMetadata: { contentType: optimized.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  const dims = optimized.ext === "webp" ? webpDimensions(optimized.bytes) : null;
  await recordToonAsset(env, toon.id, fileKey, dims?.width ?? null, dims?.height ?? null);
  return {
    fileKey,
    ext: optimized.ext,
    type: optimized.type,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  };
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
  const isReplicate = job.provider === "replicate-flux" || job.provider === "replicate-seedream";
  const isRunware = job.provider === "runware";
  const resolvedImages = isRunware ? resolvedImagesFromJob(job) : [];
  const outputs: (ComfyHistoryImage | string)[] = []; // string = Flux/Replicate/Runware's signed output URL
  let phase: ComfyPhase | null = null;
  for (let i = 0; i < promptIds.length; i++) {
    const promptId = promptIds[i];
    if (isFlux || isReplicate || isRunware) {
      // For Flux/Replicate, promptId is the full polling URL; for Runware it's the taskUUID.
      // Runware answers the submit call synchronously, so the image is normally already known
      // (resolvedImages, stashed at submit time) — runwareResult's getResponse poll is only a
      // fallback for the rare case the submit response didn't carry it.
      const result = isFlux
        ? await fluxResult(env, promptId)
        : isReplicate
          ? await replicateResult(env, promptId)
          : resolvedImages[i]
            ? ({ ok: true, phase: "done", imageUrl: resolvedImages[i]! } as const)
            : await runwareResult(env, promptId);
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

  // Never trust the requested size from the job payload for what gets stored — an image
  // provider (seen with Flux) can silently return a different size than it was asked for.
  // Each plate's real dimensions come from its own downloaded bytes, sniffed via
  // webpDimensions(), and only fall back to the requested size if that sniff fails.
  const requested = plateSizeFromJob(job);
  const plates: { fileKey: string; width: number | null; height: number | null }[] = [];
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
      const dims = webpDimensions(downloaded.bytes);
      await recordToonAsset(env, toon.id, fileKey, dims?.width ?? requested.width, dims?.height ?? requested.height);
      plates.push({ fileKey, width: dims?.width ?? requested.width, height: dims?.height ?? requested.height });
      continue;
    }
    if (isReplicate) {
      const downloaded = await replicateDownload(image as string);
      if (!downloaded.ok) {
        await env.DB.prepare(`UPDATE generation_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
          .bind(downloaded.error, nowIso(), job.id)
          .run();
        return { ok: true, job: { ...job, status: "error", error: downloaded.error }, phase: "error" };
      }
      // Unlike Flux (always webp), Replicate's own output format isn't pinned here —
      // route through putPlate() same as the Comfy path, which sniffs the real bytes
      // and re-encodes to webp only if they aren't already.
      const stored = await putPlate(env, toon, downloaded.bytes);
      plates.push({
        fileKey: stored.fileKey,
        width: stored.width ?? requested.width,
        height: stored.height ?? requested.height,
      });
      continue;
    }
    if (isRunware) {
      const downloaded = await runwareDownload(image as string);
      if (!downloaded.ok) {
        await env.DB.prepare(`UPDATE generation_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
          .bind(downloaded.error, nowIso(), job.id)
          .run();
        return { ok: true, job: { ...job, status: "error", error: downloaded.error }, phase: "error" };
      }
      const stored = await putPlate(env, toon, downloaded.bytes);
      plates.push({
        fileKey: stored.fileKey,
        width: stored.width ?? requested.width,
        height: stored.height ?? requested.height,
      });
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
    plates.push({
      fileKey: stored.fileKey,
      width: stored.width ?? requested.width,
      height: stored.height ?? requested.height,
    });
  }

  let resultPageId = job.page_id;
  for (let i = 0; i < plates.length; i++) {
    const { fileKey, width, height } = plates[i];
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
