/**
 * Public like counter on the editor D1 (replaces worker/likes KV).
 *
 *   GET  /likes              -> { likes: { [toon]: n } }
 *   GET  /likes?toon=<id>    -> { toon, likes }
 *   POST /likes { toon }     -> { toon, likes, counted }
 */

import { isMethod } from "./httpMethod";
import type { CorsHeaders, Env, JsonRecord, JsonResponse } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOON_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function allowList(env: Env): string[] {
  return String(env.ALLOWED_TOONS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function isKnownToon(env: Env, toon: string): Promise<boolean> {
  if (!toon || !TOON_RE.test(toon) || toon.length > 64) return false;
  if (allowList(env).includes(toon)) return true;
  const row = await env.DB.prepare("SELECT slug FROM toons WHERE slug = ?").bind(toon).first<{ slug: string }>();
  return Boolean(row);
}

async function ipHash(request: Request, toon: string): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bytes = new TextEncoder().encode(`${toon}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function readCount(env: Env, toon: string): Promise<number> {
  const row = await env.DB.prepare("SELECT count FROM toon_likes WHERE toon = ?").bind(toon).first<{ count: number }>();
  const n = row ? Number(row.count) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * @returns {Promise<Response | null>} null if this request is not a likes route.
 */
export async function handleLikes(
  request: Request,
  env: Env,
  cors: CorsHeaders,
  json: JsonResponse,
  isWriteOrigin: (request: Request, env: Env) => boolean
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (path !== "/likes") return null;

  if (isMethod(request.method, "GET")) {
    const toon = url.searchParams.get("toon") || "";
    if (!toon) {
      const rows = (await env.DB.prepare("SELECT toon, count FROM toon_likes").all<{ toon: string; count: number }>())
        .results;
      const likes: Record<string, number> = {};
      for (const row of rows) likes[row.toon] = Number(row.count) || 0;
      return json({ likes }, 200, cors);
    }
    if (!(await isKnownToon(env, toon))) return json({ error: "unknown toon" }, 400, cors);
    return json({ toon, likes: await readCount(env, toon) }, 200, cors);
  }

  if (!isMethod(request.method, "POST")) return json({ error: "method not allowed" }, 405, cors);
  if (!isWriteOrigin(request, env)) return json({ error: "forbidden origin" }, 403, cors);

  let payload: JsonRecord = {};
  try {
    payload = (await request.json()) as JsonRecord;
  } catch {
    return json({ error: "invalid json" }, 400, cors);
  }

  const toon = String(payload.toon || "");
  if (!(await isKnownToon(env, toon))) return json({ error: "unknown toon" }, 400, cors);

  const hash = await ipHash(request, toon);
  const seen = await env.DB.prepare("SELECT created_at FROM toon_like_votes WHERE toon = ? AND ip_hash = ?")
    .bind(toon, hash)
    .first<{ created_at: string }>();
  const fresh = seen && Date.now() - Date.parse(seen.created_at) < DAY_MS;
  if (fresh) {
    return json({ toon, likes: await readCount(env, toon), counted: false }, 200, cors);
  }

  const ts = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO toon_likes (toon, count) VALUES (?, 1)
     ON CONFLICT(toon) DO UPDATE SET count = count + 1`
  )
    .bind(toon)
    .run();
  await env.DB.prepare(
    `INSERT INTO toon_like_votes (toon, ip_hash, created_at) VALUES (?, ?, ?)
     ON CONFLICT(toon, ip_hash) DO UPDATE SET created_at = excluded.created_at`
  )
    .bind(toon, hash, ts)
    .run();

  return json({ toon, likes: await readCount(env, toon), counted: true }, 200, cors);
}
