import type { ComfyPhase } from "./comfyClient";
import type { RunComfyModel, RunComfyModelCategory } from "./apiTypes";
import type { Env } from "./types";

export type { RunComfyModel, RunComfyModelCategory };
import { normaliseUserSecret } from "./userKeys";

/**
 * RunComfy — https://runcomfy.com's hosted **model API** (`model-api.runcomfy.net`), not the
 * Worker's own self-hosted ComfyUI (COMFY_URL/COMFY_API_KEY — a different service that happens to
 * share the word "Comfy"; see the RUNCOMFY_API_KEY comment on Env). Contract per RunComfy's own
 * docs (docs.runcomfy.com/model-apis/{async-queue-endpoints,model-catalog-endpoints,error-codes}):
 * `POST /models/{model_id}` submits (no separate "mode" path segment — `model_id` is the exact,
 * complete id the catalog endpoint returns, e.g. it may already end in a variant/mode of its own),
 * `GET /requests/{id}/status` polls, `GET /requests/{id}/result` returns the output.
 * scripts/generate-toon-page.py predates the catalog endpoint and posts to `/models/{model}/{mode}`
 * for its one hardcoded model — that happens to resolve to the same URL for that specific id, but
 * isn't the documented contract, so this client doesn't reuse that shape for an arbitrary
 * catalog-picked model.
 */
const RUNCOMFY_BASE = "https://model-api.runcomfy.net/v1";
const MAX_REFS = 10; // the model's own documented limit (generate-toon-page.py)

function runComfyToken(env: Env): string {
  return env.RUNCOMFY_API_KEY ? normaliseUserSecret(env.RUNCOMFY_API_KEY) : "";
}

function runComfyHeaders(env: Env): Headers {
  const headers = new Headers({ "Content-Type": "application/json", accept: "application/json" });
  const token = runComfyToken(env);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

/** 401/403, or the documented `UserAccountError` (code 400004) — RunComfy's own error-codes docs
 * put "invalid authentication" under a 400, not 401, for this one case. */
function isAuthError(status: number, bodyText: string): boolean {
  if (status === 401 || status === 403) return true;
  return status === 400 && (bodyText.includes("400004") || bodyText.includes("UserAccountError"));
}

/**
 * Nearest of RunComfy's own documented aspect_ratio enum (generate-toon-page.py's --aspect-ratio
 * choices) — omitting the field entirely defaults to a square, which is wrong for every plate size
 * this app uses.
 */
const ASPECT_RATIOS: readonly [string, number][] = [
  ["1:1", 1],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
  ["3:2", 3 / 2],
  ["2:3", 2 / 3],
  ["21:9", 21 / 9],
];

function nearestAspectRatio(width?: number | null, height?: number | null): string | undefined {
  if (!width || !height) return undefined;
  const target = Math.log(width / height);
  let best = ASPECT_RATIOS[0];
  let bestDiff = Infinity;
  for (const entry of ASPECT_RATIOS) {
    const diff = Math.abs(Math.log(entry[1]) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return best[0];
}

type SubmitResponse = { request_id?: string; id?: string };

export async function runComfySubmit(
  env: Env,
  input: { prompt: string; images: string[]; model: string; width?: number | null; height?: number | null }
): Promise<{ ok: true; id: string; pollingUrl: string } | { ok: false; error: string }> {
  if (!runComfyToken(env)) return { ok: false, error: "RunComfy is not configured (RUNCOMFY_API_KEY missing)" };
  if (!input.model.trim()) return { ok: false, error: "series has no RunComfy model configured" };
  const refs = input.images.slice(0, MAX_REFS);

  const payload: Record<string, unknown> = {
    prompt: input.prompt,
    resolution: "1K",
    output_format: "png",
  };
  // A text-to-image model (the series character generator) is called with no refs at all — its
  // catalog entry never had an `image` input to begin with, so the key is omitted rather than
  // sent empty (see runComfyListModels's `category` — image-to-image vs text-to-image).
  if (refs.length) payload.image = refs;
  const aspectRatio = nearestAspectRatio(input.width, input.height);
  if (aspectRatio) payload.aspect_ratio = aspectRatio;

  const res = await fetch(`${RUNCOMFY_BASE}/models/${input.model.trim()}`, {
    method: "POST",
    headers: runComfyHeaders(env),
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    if (isAuthError(res.status, text)) return { ok: false, error: "RunComfy rejected the API key" };
    return { ok: false, error: `RunComfy request failed (${res.status}) ${text.slice(0, 300)}` };
  }
  let parsed: SubmitResponse = {};
  try {
    parsed = JSON.parse(text) as SubmitResponse;
  } catch {
    return { ok: false, error: "RunComfy request returned non-JSON" };
  }
  const id = parsed.request_id || parsed.id;
  if (!id) return { ok: false, error: "RunComfy request returned no request_id" };
  return { ok: true, id, pollingUrl: id };
}

/** Queue-status vocabulary only ("in_queue" | "in_progress" | "completed" | "cancelled", per
 * docs.runcomfy.com/model-apis/async-queue-endpoints) — "completed" means the job finished
 * running, not that it succeeded. Whether it actually produced an image is the *result*
 * endpoint's own `status` field ("succeeded"/"failed"), checked separately below. */
function runComfyQueuePhase(status: string): ComfyPhase | null {
  const s = status.toLowerCase();
  if (!s) return null;
  if (s === "completed") return "done";
  if (s === "cancelled") return "error";
  return "running"; // in_queue, in_progress, or anything unrecognized yet
}

/**
 * Result payloads vary in shape across models — pull every http(s) image URL found anywhere in
 * the JSON rather than assuming one fixed field, same as generate-toon-page.py's collect_urls().
 */
function collectImageUrls(node: unknown, out: string[]): string[] {
  if (typeof node === "string") {
    if (/^https?:\/\//.test(node) && /\.(png|jpe?g|webp)(\?|$)/i.test(node)) out.push(node);
  } else if (Array.isArray(node)) {
    for (const v of node) collectImageUrls(v, out);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) collectImageUrls(v, out);
  }
  return out;
}

/**
 * `requestId` must be the id `runComfySubmit` returned. `submittedRefs` are the reference image
 * URLs that request was submitted with — the result payload echoes its own inputs back
 * (generate-toon-page.py's own comment: "the result echoes the inputs, so drop anything we sent
 * before picking the output"), so without excluding them collectImageUrls could return one of the
 * references instead of the actual generated plate.
 */
export async function runComfyResult(
  env: Env,
  requestId: string,
  submittedRefs: readonly string[] = []
): Promise<{ ok: true; phase: ComfyPhase | null; imageUrl?: string } | { ok: false; error: string }> {
  const statusRes = await fetch(`${RUNCOMFY_BASE}/requests/${requestId}/status`, {
    headers: runComfyHeaders(env),
  });
  if (!statusRes.ok) {
    const text = await statusRes.text();
    return { ok: false, error: `RunComfy status check failed (${statusRes.status}) ${text.slice(0, 200)}` };
  }
  const statusBody = (await statusRes.json()) as { status?: string };
  const queuePhase = runComfyQueuePhase(String(statusBody.status || ""));
  if (queuePhase === "error") return { ok: false, error: "RunComfy job was cancelled" };
  if (queuePhase !== "done") return { ok: true, phase: queuePhase || "running" };

  const resultRes = await fetch(`${RUNCOMFY_BASE}/requests/${requestId}/result`, {
    headers: runComfyHeaders(env),
  });
  if (!resultRes.ok) {
    const text = await resultRes.text();
    return { ok: false, error: `RunComfy result fetch failed (${resultRes.status}) ${text.slice(0, 200)}` };
  }
  const resultBody = (await resultRes.json()) as { status?: string; error?: unknown };
  // The queue-status "completed" only means the job finished running — this is the field that
  // says whether it actually produced an image ("succeeded") or not.
  if (resultBody.status && resultBody.status.toLowerCase() !== "succeeded") {
    const detail = resultBody.error
      ? `: ${typeof resultBody.error === "string" ? resultBody.error : JSON.stringify(resultBody.error).slice(0, 200)}`
      : "";
    return { ok: false, error: `RunComfy job ${resultBody.status}${detail}` };
  }
  const excluded = new Set(submittedRefs);
  const urls = collectImageUrls(resultBody, []).filter((u) => !excluded.has(u));
  if (!urls.length) return { ok: false, error: "RunComfy result had no image" };
  return { ok: true, phase: "done", imageUrl: urls[0] };
}

export async function runComfyDownload(
  url: string
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; error: string }> {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: `RunComfy image download failed (${res.status})` };
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) return { ok: false, error: "RunComfy image download was empty" };
  return { ok: true, bytes };
}

type CatalogModel = { model_id?: string; display_name?: string; categories?: string[] };

/**
 * RunComfy's own model catalog (docs.runcomfy.com/model-apis/model-catalog-endpoints) —
 * `category=image-to-image` is exactly the "multi-reference" shape this series form's picker
 * needs, so the series form can list real, currently-available model ids instead of a
 * hand-maintained guess (unlike Runware's RUNWARE_MODELS, which is curated because Runware has no
 * such catalog endpoint to ask).
 */
export async function runComfyListModels(
  env: Env,
  category: RunComfyModelCategory = "image-to-image"
): Promise<{ ok: true; models: RunComfyModel[] } | { ok: false; error: string }> {
  if (!runComfyToken(env)) return { ok: false, error: "RunComfy is not configured (RUNCOMFY_API_KEY missing)" };
  const res = await fetch(`${RUNCOMFY_BASE}/models?category=${category}&limit=100`, {
    headers: runComfyHeaders(env),
  });
  const text = await res.text();
  if (!res.ok) {
    if (isAuthError(res.status, text)) return { ok: false, error: "RunComfy rejected the API key" };
    return { ok: false, error: `RunComfy model list failed (${res.status}) ${text.slice(0, 300)}` };
  }
  let parsed: { models?: CatalogModel[] } = {};
  try {
    parsed = JSON.parse(text) as { models?: CatalogModel[] };
  } catch {
    return { ok: false, error: "RunComfy model list returned non-JSON" };
  }
  const models = (parsed.models || [])
    .filter((m): m is CatalogModel & { model_id: string } => Boolean(m.model_id))
    .map((m) => ({ id: m.model_id, label: m.display_name || m.model_id }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { ok: true, models };
}
