/**
 * Pages middleware: HTTP Basic auth + noindex for every non-production host.
 *
 * Production (`twentyseven.pictures`, `www`) passes straight through.
 * `toons.twentyseven.pictures` is gated (FlipFrame creator site, not public yet)
 * even though it is attached to the production Pages project. Everything else —
 * `staging.twentyseven.pictures`, the `*.pages.dev` aliases, per-deploy preview
 * URLs — needs credentials, so unreleased toons are not readable by anyone who
 * guesses the URL, and is served `X-Robots-Tag: noindex` so a staging copy of
 * the site can never compete with production in search.
 *
 * Credentials come from Pages environment variables:
 *
 *   BASIC_AUTH_USER
 *   BASIC_AUTH_PASS
 *
 * On staging, BASIC_AUTH_PASS unset skips the gate so a missing secret cannot
 * take the preview offline. The creator host fails closed: no password means 401.
 */

import { isCommunityHost } from "../src/site/communityHost";
import { withToonSsr } from "./toonSsr";

interface PagesEnv {
  BASIC_AUTH_USER?: string;
  BASIC_AUTH_PASS?: string;
  ASSETS?: { fetch: (input: Request) => Promise<Response> };
}

const PRODUCTION_HOSTS = new Set(["twentyseven.pictures", "www.twentyseven.pictures"]);

/** Constant-time-ish compare so a wrong password cannot be probed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function unauthorized(): Response {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="27 Pictures", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function credentialsOk(request: Request, env: PagesEnv): boolean {
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
  const expectedPass = env.BASIC_AUTH_PASS;
  if (!expectedPass) return false;
  return safeEqual(user, env.BASIC_AUTH_USER || "admin") && safeEqual(pass, expectedPass);
}

export const onRequest: PagesFunction<PagesEnv> = async (context) => {
  const { request, env, next } = context;
  const host = new URL(request.url).hostname;
  const isProd = PRODUCTION_HOSTS.has(host);
  const gated = isCommunityHost(host) || !isProd;

  if (gated) {
    if (isCommunityHost(host) || env.BASIC_AUTH_PASS) {
      if (!credentialsOk(request, env)) return unauthorized();
    }
  }

  const response = await next();
  const injected = await withToonSsr(request, response, fetch, env.ASSETS);

  if (!gated) return injected;
  const guarded = new Response(injected.body, {
    status: injected.status,
    headers: injected.headers,
  });
  guarded.headers.set("X-Robots-Tag", "noindex, nofollow");
  return guarded;
};
