import type { Env } from "./types";

export function comfyBase(env: Env): string | null {
  const url = env.COMFY_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

function comfyHeaders(env: Env, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const key = env.COMFY_API_KEY?.trim();
  if (key) headers.set("Authorization", `Bearer ${key}`);
  return headers;
}

export async function comfyUploadImage(
  env: Env,
  bytes: ArrayBuffer,
  filename: string
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const base = comfyBase(env);
  if (!base) return { ok: false, error: "ComfyUI is not configured" };
  const body = new FormData();
  body.set("image", new Blob([bytes]), filename);
  body.set("overwrite", "true");
  const res = await fetch(`${base}/upload/image`, { method: "POST", headers: comfyHeaders(env), body });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Comfy upload failed (${res.status}) ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as { name?: string };
  if (!json.name) return { ok: false, error: "Comfy upload returned no filename" };
  return { ok: true, name: json.name };
}

export async function comfySubmitPrompt(
  env: Env,
  graph: object
): Promise<{ ok: true; promptId: string } | { ok: false; error: string }> {
  const base = comfyBase(env);
  if (!base) return { ok: false, error: "ComfyUI is not configured" };
  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: comfyHeaders(env, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prompt: graph }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `Comfy prompt failed (${res.status}) ${text.slice(0, 300)}` };
  let parsed: { prompt_id?: string } = {};
  try {
    parsed = JSON.parse(text) as { prompt_id?: string };
  } catch {
    return { ok: false, error: "Comfy prompt returned non-JSON" };
  }
  if (!parsed.prompt_id) return { ok: false, error: "Comfy prompt returned no prompt_id" };
  return { ok: true, promptId: parsed.prompt_id };
}

export type ComfyHistoryImage = { filename: string; subfolder?: string; type?: string };

export async function comfyHistory(
  env: Env,
  promptId: string
): Promise<{ ok: true; images: ComfyHistoryImage[]; pending: boolean } | { ok: false; error: string }> {
  const base = comfyBase(env);
  if (!base) return { ok: false, error: "ComfyUI is not configured" };
  const res = await fetch(`${base}/history/${encodeURIComponent(promptId)}`, { headers: comfyHeaders(env) });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Comfy history failed (${res.status}) ${text.slice(0, 200)}` };
  }
  const body = (await res.json()) as Record<
    string,
    {
      outputs?: Record<string, { images?: ComfyHistoryImage[] }>;
      status?: { status_str?: string; completed?: boolean };
    }
  >;
  const entry = body[promptId];
  if (!entry) return { ok: true, images: [], pending: true };
  const images: ComfyHistoryImage[] = [];
  for (const out of Object.values(entry.outputs || {})) {
    if (Array.isArray(out.images)) images.push(...out.images);
  }
  const failed = String(entry.status?.status_str || "").toLowerCase() === "error";
  if (failed) return { ok: false, error: "Comfy job failed" };
  const pending = images.length === 0 && entry.status?.completed !== true;
  return { ok: true, images, pending };
}

export async function comfyView(
  env: Env,
  image: ComfyHistoryImage
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; error: string }> {
  const base = comfyBase(env);
  if (!base) return { ok: false, error: "ComfyUI is not configured" };
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder || "",
    type: image.type || "output",
  });
  const res = await fetch(`${base}/view?${params}`, { headers: comfyHeaders(env) });
  if (!res.ok) return { ok: false, error: `Comfy view failed (${res.status})` };
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) return { ok: false, error: "Comfy view returned empty image" };
  return { ok: true, bytes };
}
