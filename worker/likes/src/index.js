/**
 * Toon like counter.
 *
 *   GET  /likes?toon=<id>   -> { toon, likes }
 *   POST /likes  { toon }   -> { toon, likes, counted }
 *
 * Counts live in KV under `likes:<toon>`. A like is unauthenticated by nature,
 * so the only defences are: an allow-list of toon ids (no unbounded key
 * creation), an origin check, and one counted like per IP per toon per day
 * (`ip:<toon>:<hash>` with a TTL). `counted:false` means the vote was seen but
 * not added — the client still shows the heart filled, since it tracks the
 * reader's own vote in localStorage.
 */

const DAY_SECONDS = 86400;

function corsHeaders(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

function allowedToons(env) {
  return String(env.ALLOWED_TOONS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function readCount(env, toon) {
  const raw = await env.TOON_LIKES.get(`likes:${toon}`);
  const n = Number.parseInt(raw || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Short, non-reversible per-IP key — we never store the address itself. */
async function ipKey(request, toon) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bytes = new TextEncoder().encode(`${toon}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `ip:${toon}:${hex}`;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/likes")) return json({ error: "not found" }, 404, cors);

    if (request.method === "GET") {
      const toon = url.searchParams.get("toon") || "";
      if (!allowedToons(env).includes(toon)) return json({ error: "unknown toon" }, 400, cors);
      return json({ toon, likes: await readCount(env, toon) }, 200, cors);
    }

    if (request.method !== "POST") return json({ error: "method not allowed" }, 405, cors);
    if (!cors["Access-Control-Allow-Origin"]) return json({ error: "forbidden origin" }, 403, cors);

    let payload = {};
    try {
      payload = await request.json();
    } catch {
      return json({ error: "invalid json" }, 400, cors);
    }

    const toon = String(payload.toon || "");
    if (!allowedToons(env).includes(toon)) return json({ error: "unknown toon" }, 400, cors);

    const seenKey = await ipKey(request, toon);
    if (await env.TOON_LIKES.get(seenKey)) {
      return json({ toon, likes: await readCount(env, toon), counted: false }, 200, cors);
    }

    // KV has no atomic increment; a read-modify-write can drop a concurrent
    // like. Acceptable for a vanity counter — the alternative is Durable
    // Objects, which is a lot of machinery for a heart icon.
    const next = (await readCount(env, toon)) + 1;
    await env.TOON_LIKES.put(`likes:${toon}`, String(next));
    await env.TOON_LIKES.put(seenKey, "1", { expirationTtl: DAY_SECONDS });

    return json({ toon, likes: next, counted: true }, 200, cors);
  },
};
