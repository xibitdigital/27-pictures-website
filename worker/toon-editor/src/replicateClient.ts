import type { ComfyPhase } from "./comfyClient";
import type { Env } from "./types";

/**
 * Replicate — https://replicate.com. Two models, same host/API shape, used
 * whenever a series' `generate.provider` is "replicate-flux" (Flux Kontext,
 * multi-image variant) or "replicate-seedream" (ByteDance Seedream 4).
 * Unlike BFL's flux-2-pro (fluxClient.ts), Replicate doesn't return a
 * per-job polling host — every job polls the same api.replicate.com, but we
 * still use the `urls.get` Replicate hands back rather than reconstructing
 * it from the id, for the same reason as the BFL client: don't assume the
 * URL shape is stable across API versions.
 */
const REPLICATE_BASE = "https://api.replicate.com";

export type ReplicateKind = "replicate-flux" | "replicate-seedream";

/** flux-kontext-apps/multi-image-kontext-pro only accepts two reference images; bytedance/seedream-4 takes 1-10. */
const MAX_REFS: Record<ReplicateKind, number> = {
  "replicate-flux": 2,
  "replicate-seedream": 8,
};

function modelPath(kind: ReplicateKind): string {
  return kind === "replicate-flux" ? "flux-kontext-apps/multi-image-kontext-pro" : "bytedance/seedream-4";
}

/**
 * Both models take an `aspect_ratio` enum, not arbitrary width/height —
 * Kontext has no custom-size mode at all, and Seedream's own custom mode
 * requires >=1024px per side and >=3.6MP total, well above our plate design
 * sizes (e.g. 800x1424). Map the series' design size to the nearest of the
 * enum values these Replicate apps document, so a job matches the toon's
 * aspect instead of falling back to the model's own default framing.
 */
const ASPECT_RATIOS: readonly [string, number][] = [
  ["1:1", 1],
  ["4:5", 4 / 5],
  ["3:4", 3 / 4],
  ["2:3", 2 / 3],
  ["9:16", 9 / 16],
  ["9:21", 9 / 21],
  ["5:4", 5 / 4],
  ["4:3", 4 / 3],
  ["3:2", 3 / 2],
  ["16:9", 16 / 9],
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

function replicateHeaders(env: Env, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = env.REPLICATE_API_TOKEN?.trim();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export async function replicateSubmit(
  env: Env,
  kind: ReplicateKind,
  input: { prompt: string; images: string[]; width?: number | null; height?: number | null }
): Promise<{ ok: true; id: string; pollingUrl: string } | { ok: false; error: string }> {
  if (!env.REPLICATE_API_TOKEN?.trim()) {
    return { ok: false, error: "Replicate is not configured (REPLICATE_API_TOKEN missing)" };
  }
  const maxRefs = MAX_REFS[kind];
  const refs = input.images.slice(0, maxRefs);
  const modelInput: Record<string, unknown> = { prompt: input.prompt };
  const aspectRatio = nearestAspectRatio(input.width, input.height);
  if (aspectRatio) modelInput.aspect_ratio = aspectRatio;
  if (kind === "replicate-flux") {
    refs.forEach((url, i) => {
      modelInput[`input_image_${i + 1}`] = url;
    });
  } else if (refs.length) {
    modelInput.image_input = refs;
  }
  const res = await fetch(`${REPLICATE_BASE}/v1/models/${modelPath(kind)}/predictions`, {
    method: "POST",
    headers: replicateHeaders(env, { "Content-Type": "application/json", accept: "application/json" }),
    body: JSON.stringify({ input: modelInput }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `Replicate request failed (${res.status}) ${text.slice(0, 300)}` };
  let parsed: { id?: string; urls?: { get?: string } } = {};
  try {
    parsed = JSON.parse(text) as { id?: string; urls?: { get?: string } };
  } catch {
    return { ok: false, error: "Replicate request returned non-JSON" };
  }
  if (!parsed.id) return { ok: false, error: "Replicate request returned no id" };
  if (!parsed.urls?.get) return { ok: false, error: "Replicate request returned no polling url" };
  return { ok: true, id: parsed.id, pollingUrl: parsed.urls.get };
}

function replicatePhase(status: string): ComfyPhase | null {
  const s = status.toLowerCase();
  if (!s) return null;
  if (s === "succeeded") return "done";
  if (s === "failed" || s === "canceled") return "error";
  if (s === "starting" || s === "processing") return "running";
  return "running";
}

/** `pollingUrl` must be the exact URL replicateSubmit returned (`urls.get`) — see the module comment. */
export async function replicateResult(
  env: Env,
  pollingUrl: string
): Promise<{ ok: true; phase: ComfyPhase | null; imageUrl?: string } | { ok: false; error: string }> {
  const res = await fetch(pollingUrl, {
    headers: replicateHeaders(env, { accept: "application/json" }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Replicate result failed (${res.status}) ${text.slice(0, 200)}` };
  }
  const body = (await res.json()) as { status?: string; output?: unknown; error?: unknown };
  const phase = replicatePhase(String(body.status || ""));
  if (phase === "error") {
    const detail = body.error
      ? `: ${typeof body.error === "string" ? body.error : JSON.stringify(body.error).slice(0, 200)}`
      : "";
    return { ok: false, error: `Replicate job ${body.status || "failed"}${detail}` };
  }
  if (phase !== "done") return { ok: true, phase: phase || "running" };
  // Most Replicate image models return a single URL string; a few (batch/sequential
  // modes) return an array — take the first output either way, one plate per job.
  const out = body.output;
  const imageUrl =
    typeof out === "string" ? out : Array.isArray(out) && typeof out[0] === "string" ? out[0] : undefined;
  if (!imageUrl) return { ok: false, error: "Replicate result had no image" };
  return { ok: true, phase: "done", imageUrl };
}

export async function replicateDownload(
  url: string
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; error: string }> {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: `Replicate image download failed (${res.status})` };
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) return { ok: false, error: "Replicate image download was empty" };
  return { ok: true, bytes };
}
