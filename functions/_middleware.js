/**
 * Pages middleware: HTTP Basic auth + noindex for every non-production host.
 *
 * Production (`twentyseven.pictures`) passes straight through. Everything else —
 * `staging.twentyseven.pictures`, the `*.pages.dev` aliases, per-deploy preview
 * URLs — needs credentials, so unreleased toons are not readable by anyone who
 * guesses the URL, and is served `X-Robots-Tag: noindex` so a staging copy of
 * the site can never compete with production in search.
 *
 * Credentials come from Pages environment variables (Preview scope):
 *
 *   BASIC_AUTH_USER
 *   BASIC_AUTH_PASS
 *
 * With BASIC_AUTH_PASS unset the gate is skipped — a missing secret must not
 * take the preview offline, and production never reaches this branch anyway.
 */

const PRODUCTION_HOSTS = new Set(["twentyseven.pictures", "www.twentyseven.pictures"]);

/** Constant-time-ish compare so a wrong password cannot be probed byte by byte. */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="27 Pictures staging", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function credentialsOk(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  return safeEqual(user, env.BASIC_AUTH_USER || "admin") && safeEqual(pass, env.BASIC_AUTH_PASS);
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const host = new URL(request.url).hostname;

  if (PRODUCTION_HOSTS.has(host)) return next();

  if (env.BASIC_AUTH_PASS && !credentialsOk(request, env)) return unauthorized();

  const response = await next();
  // Response is immutable as returned by the asset handler — clone to add headers.
  const guarded = new Response(response.body, response);
  guarded.headers.set("X-Robots-Tag", "noindex, nofollow");
  return guarded;
}
