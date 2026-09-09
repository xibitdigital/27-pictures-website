import type { ComfyPhase } from "./comfyClient";
import type { Env } from "./types";

/** BFL (Black Forest Labs) Flux.2 [pro] API — https://docs.bfl.ai. Used whenever a series' `generate.provider` is set to "flux". */
const FLUX_BASE = "https://api.bfl.ai";
const MAX_REFS = 8;

function fluxHeaders(env: Env, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const key = env.BFL_API_KEY?.trim();
  if (key) headers.set("x-key", key);
  return headers;
}

export async function fluxSubmit(
  env: Env,
  input: { prompt: string; images: string[]; width?: number | null; height?: number | null; seed?: number }
): Promise<{ ok: true; id: string; pollingUrl: string } | { ok: false; error: string }> {
  if (!env.BFL_API_KEY?.trim()) return { ok: false, error: "Flux is not configured (BFL_API_KEY missing)" };
  const refs = input.images.slice(0, MAX_REFS);
  if (input.images.length > MAX_REFS) {
    return { ok: false, error: `flux-2-pro takes at most ${MAX_REFS} reference images, got ${input.images.length}` };
  }
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    output_format: "webp",
    // Dark-fantasy/horror plates trip BFL's default (2) moderation on the
    // reference images even with an innocuous prompt — 5 is flux-2-pro's
    // most permissive setting, not a guarantee every request clears it.
    safety_tolerance: 5,
  };
  refs.forEach((url, i) => {
    body[i === 0 ? "input_image" : `input_image_${i + 1}`] = url;
  });
  if (input.width) body.width = input.width;
  if (input.height) body.height = input.height;
  if (input.seed != null) body.seed = input.seed;
  const res = await fetch(`${FLUX_BASE}/v1/flux-2-pro`, {
    method: "POST",
    headers: fluxHeaders(env, { "Content-Type": "application/json", accept: "application/json" }),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `Flux request failed (${res.status}) ${text.slice(0, 300)}` };
  let parsed: { id?: string; polling_url?: string } = {};
  try {
    parsed = JSON.parse(text) as { id?: string; polling_url?: string };
  } catch {
    return { ok: false, error: "Flux request returned non-JSON" };
  }
  if (!parsed.id) return { ok: false, error: "Flux request returned no id" };
  // BFL load-balances across regional hosts — the id alone doesn't reliably resolve
  // at api.bfl.ai; only the polling_url this specific task was created on does.
  if (!parsed.polling_url) return { ok: false, error: "Flux request returned no polling_url" };
  return { ok: true, id: parsed.id, pollingUrl: parsed.polling_url };
}

/**
 * BFL's `details` on a moderated/failed job is usually `{"Moderation Reasons":
 * ["Protected Content"]}` — surface that as plain text ("Protected Content")
 * instead of the raw `{"Moderation Reasons":[...]}` blob the operator would
 * otherwise see verbatim in the job error / toast.
 */
function formatFluxDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const rec = details as Record<string, unknown>;
  const reasons = rec["Moderation Reasons"] ?? rec["moderation_reasons"];
  if (Array.isArray(reasons) && reasons.every((r) => typeof r === "string") && reasons.length) {
    return reasons.join(", ");
  }
  return JSON.stringify(details).slice(0, 200);
}

/** "Request Moderated" / "Content Moderated" / "Error" / "Failed" → a short, consistent label. */
function fluxStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("moderat")) return "moderated";
  if (s === "error" || s === "failed" || !s) return "failed";
  return status;
}

function fluxPhase(status: string): ComfyPhase | null {
  const s = status.toLowerCase();
  if (!s) return null;
  if (s === "ready") return "done";
  if (s === "error" || s === "failed" || s === "request moderated" || s === "content moderated") return "error";
  if (s === "pending") return "running";
  return "running";
}

/** `pollingUrl` must be the exact URL fluxSubmit returned — not reconstructed from the id, see the comment there. */
export async function fluxResult(
  env: Env,
  pollingUrl: string
): Promise<{ ok: true; phase: ComfyPhase | null; imageUrl?: string } | { ok: false; error: string }> {
  const res = await fetch(pollingUrl, {
    headers: fluxHeaders(env, { accept: "application/json" }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Flux result failed (${res.status}) ${text.slice(0, 200)}` };
  }
  const body = (await res.json()) as { status?: string; result?: { sample?: string }; details?: unknown };
  const phase = fluxPhase(String(body.status || ""));
  if (phase === "error") {
    const label = fluxStatusLabel(String(body.status || ""));
    const details = formatFluxDetails(body.details);
    return { ok: false, error: details ? `Flux job ${label}: ${details}` : `Flux job ${label}` };
  }
  if (phase !== "done") return { ok: true, phase: phase || "running" };
  const sample = body.result?.sample;
  if (!sample) return { ok: false, error: "Flux result had no image" };
  return { ok: true, phase: "done", imageUrl: sample };
}

export async function fluxDownload(
  url: string
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; error: string }> {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: `Flux image download failed (${res.status})` };
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) return { ok: false, error: "Flux image download was empty" };
  return { ok: true, bytes };
}
