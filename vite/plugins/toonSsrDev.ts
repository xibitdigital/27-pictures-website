/**
 * Dev: stamp D1 catalog/hub/reader HTML the same way the Pages Function does.
 * Catalog `/toons/` is transformIndexHtml. Nested hubs and readers have no
 * source file — middleware serves `_hub` / `_reader` templates.
 *
 * `transformIndexHtml` must not fetch /catalog for those templates: hub
 * middleware already loaded the payload, and a nested fetch on the same
 * Miniflare worker serializes (or deadlocks) so `/toons/` never finishes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import {
  matchToonRoute,
  parseCatalog,
  payloadForEditor,
  ownerUsernames,
  type CatalogPayload,
} from "../../src/site/catalogRender";
import { isCommunityHost } from "../../src/site/communityHost";
import { applyCommunityHomeHtml, communityRedirect, communityUsername } from "../../src/site/communityPages";
import { applyHubHtml, applyReaderHtml } from "../../src/site/toonPages";
import { injectToonHtml, resolveStagingReader } from "../../functions/toonSsr";
import { DEFAULT_ASSET_BASE, renderCatalogSitemap, renderLlmsTxt } from "../../src/site/crawlerDocs";
import { splitLocale } from "../../src/site/i18n";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const CATALOG_TTL_MS = 60_000;

/** `_hub` / `_reader` shells — SSR is applied after Vite HTML transform. */
export function isToonShellPath(urlPath: string): boolean {
  const p = urlPath.replace(/\\/g, "/");
  return p.includes("/toons/_hub/") || p.includes("/toons/_reader/") || p.includes("/toons/_community/");
}

export function createDevCatalogLoader(opts?: {
  ttlMs?: number;
  fetchImpl?: typeof fetch;
}): (site: string) => Promise<CatalogPayload | null> {
  const ttl = opts?.ttlMs ?? CATALOG_TTL_MS;
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const caches = new Map<string, { at: number; payload: CatalogPayload }>();
  const inflight = new Map<string, Promise<CatalogPayload | null>>();

  return (site: string) => {
    const hit = caches.get(site);
    if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.payload);
    const pending = inflight.get(site);
    if (pending) return pending;
    const job = (async () => {
      const target = process.env.VITE_EDITOR_PROXY_TARGET || "http://127.0.0.1:8787";
      try {
        const res = await fetchImpl(`${target}/catalog?site=${encodeURIComponent(site)}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return caches.get(site)?.payload ?? null;
        const payload = parseCatalog(await res.json());
        if (payload) caches.set(site, { at: Date.now(), payload });
        return payload;
      } catch {
        return caches.get(site)?.payload ?? null;
      } finally {
        inflight.delete(site);
      }
    })();
    inflight.set(site, job);
    return job;
  };
}

export function toonSsrDevPlugin(): Plugin {
  const loadCatalog = createDevCatalogLoader();

  return {
    name: "toon-ssr-dev",
    transformIndexHtml: {
      order: "post",
      async handler(html, ctx) {
        if (!ctx.server) return html;
        if (isToonShellPath(ctx.path || ctx.filename || "")) return html;
        if (!html.includes("data-toon-catalog") && !html.includes("data-series-jsonld")) return html;
        const pathName = (ctx.originalUrl || ctx.path || "/").split("?")[0];
        const site = `http://127.0.0.1:${ctx.server.config.server.port ?? 5173}`;
        const payload = await loadCatalog(site);
        if (!payload) return html;
        return injectToonHtml(html, payload, `${site}${pathName.startsWith("/") ? pathName : `/${pathName}`}`);
      },
    },
    configureServer(server) {
      const port = () => server.config.server.port ?? 5173;
      const siteFor = (req: { headers: { host?: string } }) => {
        const host = String(req.headers.host || "")
          .split(":")[0]
          .toLowerCase();
        if (isCommunityHost(host)) return `http://${host}:${port()}`;
        return `http://127.0.0.1:${port()}`;
      };
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const url = (req.url || "").split("?")[0];
        const site = siteFor(req);
        const community = isCommunityHost(new URL(site).hostname);
        const requestUrl = `${site}${url.endsWith("/") || url.includes(".") ? url : `${url}/`}`;
        if (community) {
          const dest = communityRedirect(requestUrl);
          if (dest) {
            res.statusCode = 301;
            res.setHeader("Location", dest);
            res.end();
            return;
          }
        }
        if (url === "/llms.txt" || url === "/sitemap.xml") {
          const payload = await loadCatalog(site);
          if (!payload) return next();
          if (url === "/llms.txt") {
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(renderLlmsTxt(site, payload));
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.end(renderCatalogSitemap(site, payload, process.env.VITE_ASSET_BASE || DEFAULT_ASSET_BASE));
          return;
        }
        const { path: sitePath } = splitLocale(url);
        try {
          if (community) {
            const homePath = sitePath === "/" || sitePath === "";
            const editor = homePath ? null : communityUsername(url);
            if (homePath || editor) {
              const catalog = (await loadCatalog(site)) || { series: [], ungrouped: [] };
              if (editor) {
                const slice = payloadForEditor(catalog, editor);
                const known = ownerUsernames(catalog).some((name) => name.toLowerCase() === editor);
                if (!known && !slice.series.length && !slice.ungrouped.length) return next();
              }
              const file = path.join(srcDir, "toons/_community/index.html");
              if (!fs.existsSync(file)) return next();
              const raw = fs.readFileSync(file, "utf8");
              const transformed = await server.transformIndexHtml("/toons/_community/index.html", raw);
              res.statusCode = 200;
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.end(applyCommunityHomeHtml(transformed, catalog, requestUrl, editor || undefined));
              return;
            }
          }
          if (
            !sitePath.startsWith("/toons/") ||
            sitePath.startsWith("/toons/editor") ||
            sitePath.startsWith("/toons/_")
          ) {
            return next();
          }
          if (sitePath === "/toons/") return next();
          const payload = await loadCatalog(site);
          const route = payload ? matchToonRoute(url, payload) : null;
          const editorApi = process.env.VITE_EDITOR_PROXY_TARGET || "http://127.0.0.1:8787";
          const unlisted =
            !community && (!route || (route.kind !== "hub" && route.kind !== "reader"))
              ? await resolveStagingReader(url, fetch, editorApi)
              : null;
          if (route?.kind !== "hub" && route?.kind !== "reader" && !unlisted) return next();
          const tplRel = route?.kind === "hub" ? "toons/_hub/index.html" : "toons/_reader/index.html";
          const file = path.join(srcDir, tplRel);
          if (!fs.existsSync(file)) return next();
          const raw = fs.readFileSync(file, "utf8");
          const transformed = await server.transformIndexHtml(`/${tplRel}`, raw);
          const html =
            route?.kind === "hub"
              ? applyHubHtml(transformed, route.series, requestUrl)
              : applyReaderHtml(
                  transformed,
                  route?.kind === "reader" ? route.episode : unlisted!.episode,
                  route?.kind === "reader" ? route.series : unlisted!.series || undefined,
                  requestUrl,
                  unlisted && route?.kind !== "reader" ? { noindex: true } : undefined
                );
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        } catch {
          next();
        }
      });
    },
  };
}
