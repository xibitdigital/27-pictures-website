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
  }
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

  const outputs: ComfyHistoryImage[] = [];
  let phase: ComfyPhase | null = null;
  for (const promptId of promptIds) {
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
    const viewed = await comfyView(env, image);
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
