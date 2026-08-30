/**
 * Stamp D1 catalog / hub / reader HTML at the site origin so crawlers that
 * skip JavaScript still see cards, fallback copy and JSON-LD.
 */
import {
  catalogJsonLd,
  cardDescription,
  episodeCardHtml,
  episodesHeading,
  isToonIndexPath,
  landingGridHtml,
  matchToonRoute,
  parseCatalog,
  seriesForRequest,
  seriesJsonLd,
  type CatalogPayload,
} from "../src/site/catalogRender";
import { splitLocale } from "../src/site/i18n";
import { applyHubHtml, applyReaderHtml, HUB_TEMPLATE_PATH, READER_TEMPLATE_PATH } from "../src/site/toonPages";

export const EDITOR_API = "https://toon-editor.sangalli-marco.workers.dev";

const catalogCache = new Map<string, { at: number; payload: CatalogPayload }>();
const CACHE_MS = 60_000;

export async function loadCatalogForOrigin(
  origin: string,
  fetcher: typeof fetch = fetch
): Promise<CatalogPayload | null> {
  const hit = catalogCache.get(origin);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.payload;
  const url = `${EDITOR_API}/catalog?site=${encodeURIComponent(origin)}`;
  try {
    const res = await fetcher(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const payload = parseCatalog(await res.json());
    if (payload) catalogCache.set(origin, { at: Date.now(), payload });
    return payload;
  } catch {
    return null;
  }
}

function pageUrlFromHtml(html: string, requestUrl: string): string {
  const m = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (m?.[1]) return m[1].endsWith("/") ? m[1] : `${m[1]}/`;
  const u = new URL(requestUrl);
  const path = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
  return `${u.origin}${path}`;
}

function replaceAttrText(html: string, attr: string, value: string): string {
  const re = new RegExp(`(<[^>]*\\b${attr}\\b[^>]*>)([\\s\\S]*?)(</[^>]+>)`, "g");
  return html.replace(re, (_, open: string, _inner: string, close: string) => `${open}${value}${close}`);
}

function fillEmptyDiv(html: string, attr: string, inner: string): string {
  const re = new RegExp(`(<div\\b[^>]*\\b${attr}\\b[^>]*>)\\s*(</div>)`);
  if (!re.test(html)) return html;
  return html.replace(re, `$1\n${inner}\n            $2`);
}

function replaceScript(html: string, attr: string, json: unknown): string {
  const open = `<script type="application/ld+json" ${attr}>`;
  const start = html.indexOf(open);
  if (start < 0) return html;
  const end = html.indexOf("</script>", start);
  if (end < 0) return html;
  const body = JSON.stringify(json, null, 2);
  return `${html.slice(0, start)}${open}\n${body}\n    </script>${html.slice(end + "</script>".length)}`;
}

export function injectToonHtml(html: string, payload: CatalogPayload, requestUrl: string): string {
  const pathname = new URL(requestUrl).pathname;
  const { locale } = splitLocale(pathname);
  const pageUrl = pageUrlFromHtml(html, requestUrl);
  let out = html;

  if (isToonIndexPath(pathname) && html.includes("data-toon-catalog")) {
    out = fillEmptyDiv(out, "data-toon-catalog", landingGridHtml(payload, locale));
    if (html.includes("data-toon-jsonld")) {
      out = replaceScript(out, "data-toon-jsonld", catalogJsonLd(payload, { pageUrl, locale }));
    }
  }

  const series = seriesForRequest(html, pathname, payload);
  if (series && (html.includes("data-series-episodes") || html.includes("data-series-jsonld"))) {
    const cards = series.episodes.map((ep) => episodeCardHtml(ep, locale)).join("\n");
    out = fillEmptyDiv(out, "data-series-episodes", cards);
    const lead = cardDescription(series, locale);
    out = replaceAttrText(out, "data-series-title", series.title);
    if (lead) out = replaceAttrText(out, "data-series-lead", lead);
    out = replaceAttrText(out, "data-series-episodes-heading", episodesHeading(series.episodes.length, locale));
    if (html.includes("data-series-jsonld")) {
      out = replaceScript(out, "data-series-jsonld", seriesJsonLd(series, { pageUrl, locale }));
    }
  }

  return out;
}

export type AssetStore = { fetch: (input: Request) => Promise<Response> };

async function loadTemplate(
  request: Request,
  path: string,
  assets?: AssetStore,
  fetcher: typeof fetch = fetch
): Promise<string | null> {
  const url = new URL(path, request.url);
  try {
    const res = assets ? await assets.fetch(new Request(url.toString())) : await fetcher(url.toString());
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function withToonSsr(
  request: Request,
  response: Response,
  fetcher: typeof fetch = fetch,
  assets?: AssetStore
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const { path } = splitLocale(pathname);
  if (!path.startsWith("/toons") || path.startsWith("/toons/editor") || path.startsWith("/toons/_")) {
    return response;
  }

  const origin = new URL(request.url).origin;
  const payload = await loadCatalogForOrigin(origin, fetcher);
  const type = response.headers.get("content-type") || "";
  const htmlOk = type.includes("text/html");
  const replay = (body: string, status = 200) => {
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
    return new Response(body, { status, headers });
  };

  if (isToonIndexPath(pathname) && response.status === 200 && htmlOk) {
    if (!payload) return response;
    const html = await response.text();
    return replay(injectToonHtml(html, payload, request.url));
  }

  if (!payload) return response;
  const route = matchToonRoute(pathname, payload);
  if (!route) return response;

  if (route.kind === "hub") {
    const tpl = await loadTemplate(request, HUB_TEMPLATE_PATH, assets, fetcher);
    if (!tpl) return response;
    return replay(applyHubHtml(tpl, route.series, request.url));
  }

  if (route.kind !== "reader") return response;
  const tpl = await loadTemplate(request, READER_TEMPLATE_PATH, assets, fetcher);
  if (!tpl) return response;
  return replay(applyReaderHtml(tpl, route.episode, route.series, request.url));
}
