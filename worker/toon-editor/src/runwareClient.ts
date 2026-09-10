import type { ComfyPhase } from "./comfyClient";
import { RUNWARE_MODELS } from "./apiTypes";
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

function maxReferenceImages(model: string): number {
  return RUNWARE_MODELS.find((m) => m.id === model)?.maxReferenceImages ?? DEFAULT_MAX_REFS;
}

/**
 * Runware rejects width×height outside [921600, 4624220] total pixels
 * (`invalidPixels`) and requires both dimensions be multiples of 64 — a
 * region fill (often well under 960×960) or a wide plate design otherwise
 * 400s at submit. Scale to the nearest in-budget size on the requested
 * aspect ratio, then round to the required step; the actual stored plate
 * size still comes from the downloaded bytes (pollPageJob), not this.
 */
const MIN_PIXELS = 921600;
const MAX_PIXELS = 4624220;
const DIM_STEP = 64;

function roundToStep(n: number): number {
  return Math.max(DIM_STEP, Math.round(n / DIM_STEP) * DIM_STEP);
}

function clampToPixelBudget(width: number, height: number): { width: number; height: number } {
  const total = width * height;
  const scale =
    total < MIN_PIXELS ? Math.sqrt(MIN_PIXELS / total) : total > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / total) : 1;
  let w = roundToStep(width * scale);
  let h = roundToStep(height * scale);
  // Rounding to the 64px step can tip a near-boundary size back out of budget — nudge back in.
  for (let i = 0; i < 64 && w * h < MIN_PIXELS; i++) {
    w += DIM_STEP;
    h += DIM_STEP;
  }
  for (let i = 0; i < 64 && w * h > MAX_PIXELS && w > DIM_STEP && h > DIM_STEP; i++) {
    w -= DIM_STEP;
    h -= DIM_STEP;
  }
  return { width: w, height: h };
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

export async function runwareSubmit(
  env: Env,
  input: { prompt: string; images: string[]; model: string; width?: number | null; height?: number | null }
): Promise<{ ok: true; id: string; pollingUrl: string } | { ok: false; error: string }> {
  if (!runwareToken(env)) return { ok: false, error: "Runware is not configured (RUNWARE_API_KEY missing)" };
  if (!input.model.trim()) return { ok: false, error: "series has no Runware model configured" };
  if (!input.width || !input.height) return { ok: false, error: "Runware needs a plate width and height" };

  const taskUUID = crypto.randomUUID();
  const refs = input.images.slice(0, maxReferenceImages(input.model.trim()));
  const { width, height } = clampToPixelBudget(input.width, input.height);
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
  if (isAuthError(res.status, error)) return { ok: false, error: RUNWARE_TOKEN_REJECTED };
  if (!res.ok) return { ok: false, error: `Runware request failed (${res.status}) ${text.slice(0, 300)}` };
  if (error) return { ok: false, error: `Runware rejected the request: ${error.message || error.code}` };
  const data = parsed.data && parsed.data[0];
  if (!data?.taskUUID) return { ok: false, error: "Runware request returned no task" };
  return { ok: true, id: data.taskUUID, pollingUrl: data.taskUUID };
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
