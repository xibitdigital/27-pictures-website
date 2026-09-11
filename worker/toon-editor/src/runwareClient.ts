import type { ComfyPhase } from "./comfyClient";
import { RUNWARE_MODELS, type RunwareDimensions } from "./apiTypes";
import type { Env } from "./types";
import { normaliseUserSecret } from "./userKeys";

/**
 * Runware — https://runware.ai. One REST endpoint for every model on the
 * platform (`generate.provider === "runware"`): the request is a JSON array
 * of tasks, auth is a Bearer token, and the model to hit is the series'
 * `generate.model`, picked in the series form from `RUNWARE_MODELS`
 * (apiTypes.ts) — Runware's model directory is large and changes
 * independently of this codebase, so only the curated, verified subset is
 * offered rather than free text. Submitting and polling both hit the same
 * base URL with a different `taskType`; unlike Replicate there's no per-job
 * "get" URL to remember, so `runwareResult` takes the `taskUUID` submit
 * returned instead of a full URL.
 */
const RUNWARE_BASE = "https://api.runware.ai/v1";

const DEFAULT_MAX_REFS = 2; // conservative fallback if generate.model isn't one of RUNWARE_MODELS
// Same bounds Seedream 5.0 Pro documents (confirmed against its own `invalidPixels` error) — used
// only as a fallback for a model id that isn't in RUNWARE_MODELS (stale series config).
const DEFAULT_DIMENSIONS: RunwareDimensions = {
  kind: "range",
  minPixels: 921600,
  maxPixels: 4624220,
  minSide: 256,
  maxSide: 16383,
};

function modelConfig(model: string) {
  return RUNWARE_MODELS.find((m) => m.id === model);
}

function maxReferenceImages(model: string): number {
  return modelConfig(model)?.maxReferenceImages ?? DEFAULT_MAX_REFS;
}

/** Nearest of a fixed pair list by aspect ratio (log scale, same technique as replicateClient's nearestAspectRatio). */
function nearestFixedPair(pairs: readonly (readonly [number, number])[], width: number, height: number) {
  const target = Math.log(width / height);
  let best = pairs[0];
  let bestDiff = Infinity;
  for (const pair of pairs) {
    const diff = Math.abs(Math.log(pair[0] / pair[1]) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = pair;
    }
  }
  return { width: best[0], height: best[1] };
}

/**
 * Fits the requested size to whichever dimension contract the model
 * documents (apiTypes.ts's RunwareModel.dimensions): a fixed model (Flux
 * Kontext) only accepts one of a handful of exact pairs, so pick the
 * closest by aspect ratio; a ranged model (Seedream) accepts any integer
 * size within an area/side budget, so scale onto it instead. Sending a size
 * outside either contract is Runware's `invalidPixels`/`invalidDimensions`
 * 400 — the actual stored plate size still comes from the downloaded bytes
 * (pollPageJob), not this.
 */
function fitDimensions(dims: RunwareDimensions, width: number, height: number): { width: number; height: number } {
  if (dims.kind === "fixed") return nearestFixedPair(dims.pairs, width, height);
  const total = width * height;
  const scalingUp = total < dims.minPixels;
  const scale = scalingUp
    ? Math.sqrt(dims.minPixels / total)
    : total > dims.maxPixels
      ? Math.sqrt(dims.maxPixels / total)
      : 1;
  // Rounding each side independently can land the product just under minPixels even though the
  // scale was computed to hit it exactly (reported as Runware's invalidPixels 400) — ceil() on
  // the way up and floor() on the way down keeps each side's rounding error on the safe side of
  // the target area (ceil(a)*ceil(b) >= a*b >= floor(a)*floor(b) for positive a, b).
  const round = scalingUp ? Math.ceil : scale < 1 ? Math.floor : Math.round;
  const clampSide = (n: number) => Math.min(dims.maxSide, Math.max(dims.minSide, round(n)));
  return { width: clampSide(width * scale), height: clampSide(height * scale) };
}

export const RUNWARE_TOKEN_REJECTED =
  "Runware rejected the API key. Settings showing Set only means a value is stored — Clear it, paste a fresh key from runware.ai/api-keys, and Save.";

type RunwareError = { code?: string; message?: string; taskUUID?: string };
type RunwareEnvelope<T> = { data?: T[]; errors?: RunwareError[] };

function runwareToken(env: Env): string {
  return env.RUNWARE_API_KEY ? normaliseUserSecret(env.RUNWARE_API_KEY) : "";
}

function runwareHeaders(env: Env): Headers {
  const headers = new Headers({ "Content-Type": "application/json", accept: "application/json" });
  const token = runwareToken(env);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

function firstError(errors: RunwareError[] | undefined): RunwareError | null {
  return errors && errors.length ? errors[0] : null;
}

function isAuthError(status: number, error: RunwareError | null): boolean {
  return status === 401 || status === 403 || error?.code === "invalidApiKey";
}

/** Cheap auth check used when saving a per-user key, so a truncated/masked paste fails at Save instead of at Generate. */
export async function runwareVerifyToken(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalised = normaliseUserSecret(token);
  if (!normalised) return { ok: false, error: "Runware API key is empty" };
  const res = await fetch(RUNWARE_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify([{ taskType: "authentication", apiKey: normalised }]),
  });
  const text = await res.text();
  let parsed: RunwareEnvelope<unknown> = {};
  try {
    parsed = JSON.parse(text) as RunwareEnvelope<unknown>;
  } catch {
    parsed = {};
  }
  const error = firstError(parsed.errors);
  if (isAuthError(res.status, error)) return { ok: false, error: RUNWARE_TOKEN_REJECTED };
  if (!res.ok) return { ok: false, error: `Could not verify Runware key (${res.status})` };
  if (error) return { ok: false, error: `Runware rejected the request: ${error.message || error.code}` };
  return { ok: true };
}

type SubmitData = { taskUUID?: string; imageURL?: string; status?: string };

// Runware's own error for this ("Task processing timeout... Please try again later") is the
// *synchronous wait* giving up — confirmed against a real job whose image existed on Runware's
// side even though this call 504'd. So it isn't treated as a failure: the taskUUID we generated
// is returned same as a normal submit, just with no imageUrl, which sends it down the same
// getResponse-polling path pollPageJob already uses for a slow/async task (see resolvedImages in
// generatePage.ts) instead of losing the job (and re-spending the generation) on a fresh retry.
const TASK_TIMEOUT_CODE = "failedTaskTimeout";

export async function runwareSubmit(
  env: Env,
  input: { prompt: string; images: string[]; model: string; width?: number | null; height?: number | null }
): Promise<{ ok: true; id: string; pollingUrl: string; imageUrl?: string } | { ok: false; error: string }> {
  if (!runwareToken(env)) return { ok: false, error: "Runware is not configured (RUNWARE_API_KEY missing)" };
  if (!input.model.trim()) return { ok: false, error: "series has no Runware model configured" };
  if (!input.width || !input.height) return { ok: false, error: "Runware needs a plate width and height" };

  const taskUUID = crypto.randomUUID();
  const refs = input.images.slice(0, maxReferenceImages(input.model.trim()));
  const dims = modelConfig(input.model.trim())?.dimensions ?? DEFAULT_DIMENSIONS;
  const { width, height } = fitDimensions(dims, input.width, input.height);
  const task: Record<string, unknown> = {
    taskType: "imageInference",
    taskUUID,
    model: input.model.trim(),
    positivePrompt: input.prompt,
    width,
    height,
    numberResults: 1,
  };
  if (refs.length) task.referenceImages = refs;

  const res = await fetch(RUNWARE_BASE, { method: "POST", headers: runwareHeaders(env), body: JSON.stringify([task]) });
  const text = await res.text();
  let parsed: RunwareEnvelope<SubmitData> = {};
  try {
    parsed = JSON.parse(text) as RunwareEnvelope<SubmitData>;
  } catch {
    return { ok: false, error: "Runware request returned non-JSON" };
  }
  const error = firstError(parsed.errors);
  if (error?.code === TASK_TIMEOUT_CODE) return { ok: true, id: taskUUID, pollingUrl: taskUUID };
  if (isAuthError(res.status, error)) return { ok: false, error: RUNWARE_TOKEN_REJECTED };
  if (!res.ok) return { ok: false, error: `Runware request failed (${res.status}) ${text.slice(0, 300)}` };
  if (error) return { ok: false, error: `Runware rejected the request: ${error.message || error.code}` };
  const data = parsed.data && parsed.data[0];
  if (!data?.taskUUID) return { ok: false, error: "Runware request returned no task" };
  // We never set deliveryMethod: "async", so Runware answers this POST synchronously — the
  // image, when ready, is already in this response. `getResponse` (runwareResult) is documented
  // for async delivery only and does not reliably track a sync-delivered task, so a job that
  // relied on it here would poll "processing" forever even after Runware had already finished.
  return { ok: true, id: data.taskUUID, pollingUrl: data.taskUUID, imageUrl: data.imageURL };
}

function runwarePhase(status: string | undefined): ComfyPhase | null {
  const s = (status || "").toLowerCase();
  if (!s) return null;
  if (s === "success") return "done";
  if (s === "error") return "error";
  return "running";
}

type ResultData = { status?: string; imageURL?: string };

/** `taskUUID` must be the id `runwareSubmit` returned — Runware polls by re-asking for that task, not a per-job URL. */
export async function runwareResult(
  env: Env,
  taskUUID: string
): Promise<{ ok: true; phase: ComfyPhase | null; imageUrl?: string } | { ok: false; error: string }> {
  const res = await fetch(RUNWARE_BASE, {
    method: "POST",
    headers: runwareHeaders(env),
    body: JSON.stringify([{ taskType: "getResponse", taskUUID }]),
  });
  const text = await res.text();
  let parsed: RunwareEnvelope<ResultData> = {};
  try {
    parsed = JSON.parse(text) as RunwareEnvelope<ResultData>;
  } catch {
    return { ok: false, error: "Runware result returned non-JSON" };
  }
  const error = firstError(parsed.errors);
  if (isAuthError(res.status, error)) return { ok: false, error: RUNWARE_TOKEN_REJECTED };
  if (!res.ok) return { ok: false, error: `Runware result failed (${res.status}) ${text.slice(0, 200)}` };
  if (error) return { ok: false, error: `Runware job failed: ${error.message || error.code}` };
  const data = parsed.data && parsed.data[0];
  const phase = runwarePhase(data?.status);
  if (phase === "error") return { ok: false, error: "Runware job failed" };
  if (phase !== "done") return { ok: true, phase: phase || "running" };
  if (!data?.imageURL) return { ok: false, error: "Runware result had no image" };
  return { ok: true, phase: "done", imageUrl: data.imageURL };
}

export async function runwareDownload(
  url: string
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; error: string }> {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: `Runware image download failed (${res.status})` };
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) return { ok: false, error: "Runware image download was empty" };
  return { ok: true, bytes };
}
