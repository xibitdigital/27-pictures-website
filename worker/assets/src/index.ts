/**
 * Public CDN for plates, audio, and card-art. Binds the existing
 * `twentyseven-assets` R2 bucket (same keys as today). After this host is
 * `VITE_ASSET_BASE`, turn off the bucket's public URL — the Worker binding
 * still reads objects.
 *
 * Editor originals (`editor/…`) stay on toon-editor GET /media/.
 */

import { buildXmpPacket, injectXmp } from "./webpXmp";

export interface Env {
  ASSETS: R2Bucket;
}

const ALLOWED_PREFIXES = ["toons/", "card-art/"] as const;

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".json": "application/json",
};

const CACHE_CONTROL = "public, max-age=31536000, immutable";

const ROBOTS = `# assets.twentyseven.pictures — binary media only.
# HTML / citation crawlers use twentyseven.pictures. Training scrapers stay off the bytes.

User-agent: *
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: anthropic-ai
Disallow: /
`;

export function objectKey(pathname: string): string | null {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  path = path.replace(/^\/+/, "");
  if (!path || path.includes("..") || path.includes("\\") || path.includes("\0")) return null;
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) return null;
  return path;
}

export function contentTypeFor(key: string, stored?: string | null): string {
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  return stored || CONTENT_TYPES[ext] || "application/octet-stream";
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

function assetHeaders(type: string, etag?: string | null): Headers {
  const headers = new Headers({
    "Content-Type": type,
    "Cache-Control": CACHE_CONTROL,
    "X-Robots-Tag": "noai, noimageai, noindex",
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(),
  });
  if (etag) headers.set("ETag", etag);
  return headers;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (method !== "GET" && method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers: { Allow: "GET, HEAD, OPTIONS" } });
    }

    if (url.pathname === "/robots.txt") {
      return new Response(ROBOTS, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          "X-Robots-Tag": "noindex",
        },
      });
    }

    const key = objectKey(url.pathname);
    if (!key) return new Response("not found", { status: 404 });

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      if (method === "HEAD") return new Response(null, { status: cached.status, headers: cached.headers });
      return cached;
    }

    const object = await env.ASSETS.get(key);
    if (!object) return new Response("not found", { status: 404 });

    const etag = object.httpEtag || object.etag;
    if (etag && request.headers.get("If-None-Match") === etag) {
      return new Response(null, { status: 304, headers: assetHeaders(contentTypeFor(key), etag) });
    }

    const type = contentTypeFor(key, object.httpMetadata?.contentType);
    const headers = assetHeaders(type, etag);

    // WebP only: mux in an XMP rights/opt-out packet so the "don't train on this" signal
    // travels with the file itself, not just this response's headers. Buffering the whole
    // object is fine here — the result is what gets cached, so this only runs once per key.
    const body = type === "image/webp" ? injectXmp(new Uint8Array(await object.arrayBuffer()), buildXmpPacket()) : null;

    if (body) headers.set("Content-Length", String(body.length));
    else headers.set("Content-Length", String(object.size));

    if (method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }

    const response = new Response(body ?? object.body, { status: 200, headers });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
