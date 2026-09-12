import type { ComfyPhase } from "./comfyClient";
import type { Env } from "./types";
import { normaliseUserSecret } from "./userKeys";

/**
 * RunComfy — https://runcomfy.com's hosted **model API** (`model-api.runcomfy.net`), not the
 * Worker's own self-hosted ComfyUI (COMFY_URL/COMFY_API_KEY — a different service that happens to
 * share the word "Comfy"; see the RUNCOMFY_API_KEY comment on Env). Mirrors what
 * scripts/generate-toon-page.py already does against this same API for manual prototyping:
 * `POST /models/{model}/{mode}` submits, `GET /requests/{id}/status` polls, `GET /requests/{id}/result`
 * returns the output — every field name and URL shape below is taken straight from that script,
 * confirmed working there before this Worker path existed.
 */
const RUNCOMFY_BASE = "https://model-api.runcomfy.net/v1";
const DEFAULT_MODE = "image-to-image";
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
  if (!refs.length) return { ok: false, error: "RunComfy needs at least one reference image" };

  const payload: Record<string, unknown> = {
    prompt: input.prompt,
    image: refs,
    resolution: "1K",
    output_format: "png",
  };
  const aspectRatio = nearestAspectRatio(input.width, input.height);
  if (aspectRatio) payload.aspect_ratio = aspectRatio;

  const res = await fetch(`${RUNCOMFY_BASE}/models/${input.model.trim()}/${DEFAULT_MODE}`, {
    method: "POST",
    headers: runComfyHeaders(env),
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return { ok: false, error: "RunComfy rejected the API key" };
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

function runComfyPhase(status: string): ComfyPhase | null {
  const s = status.toLowerCase();
  if (!s) return null;
  if (s === "completed") return "done";
  if (s === "cancelled" || s === "failed" || s === "error") return "error";
  return "running";
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
  const statusBody = (await statusRes.json()) as { status?: string; state?: string };
  const phase = runComfyPhase(String(statusBody.status || statusBody.state || ""));
  if (phase === "error") return { ok: false, error: "RunComfy job failed" };
  if (phase !== "done") return { ok: true, phase: phase || "running" };

  const resultRes = await fetch(`${RUNCOMFY_BASE}/requests/${requestId}/result`, {
    headers: runComfyHeaders(env),
  });
  if (!resultRes.ok) {
    const text = await resultRes.text();
    return { ok: false, error: `RunComfy result fetch failed (${resultRes.status}) ${text.slice(0, 200)}` };
  }
  const resultBody: unknown = await resultRes.json();
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
