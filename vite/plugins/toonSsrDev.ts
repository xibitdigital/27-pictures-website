/**
 * Dev: stamp D1 catalog/hub/reader HTML the same way the Pages Function does.
 * Catalog `/toons/` is transformIndexHtml. Nested hubs and readers have no
 * source file — middleware serves `_hub` / `_reader` templates.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { matchToonRoute, parseCatalog } from "../../src/site/catalogRender";
import { applyHubHtml, applyReaderHtml } from "../../src/site/toonPages";
import { injectToonHtml } from "../../functions/toonSsr";
import { DEFAULT_ASSET_BASE, renderCatalogSitemap, renderLlmsTxt } from "../../src/site/crawlerDocs";
import { splitLocale } from "../../src/site/i18n";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");

export function toonSsrDevPlugin(): Plugin {
  return {
    name: "toon-ssr-dev",
    transformIndexHtml: {
      order: "post",
      async handler(html, ctx) {
        if (!ctx.server) return html;
        if (!html.includes("data-toon-catalog") && !html.includes("data-series-jsonld")) return html;
        const target = process.env.VITE_EDITOR_PROXY_TARGET || "http://127.0.0.1:8787";
        const pathName = (ctx.originalUrl || ctx.path || "/").split("?")[0];
        const site = `http://127.0.0.1:${ctx.server.config.server.port ?? 5173}`;
        try {
          const res = await fetch(`${target}/catalog?site=${encodeURIComponent(site)}`, {
            headers: { Accept: "application/json" },
          });
          if (!res.ok) return html;
          const payload = parseCatalog(await res.json());
          if (!payload) return html;
          return injectToonHtml(html, payload, `${site}${pathName.startsWith("/") ? pathName : `/${pathName}`}`);
        } catch {
          return html;
        }
      },
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const url = (req.url || "").split("?")[0];
        if (url === "/llms.txt" || url === "/sitemap.xml") {
          const target = process.env.VITE_EDITOR_PROXY_TARGET || "http://127.0.0.1:8787";
          const site = `http://127.0.0.1:${server.config.server.port ?? 5173}`;
          try {
            const cat = await fetch(`${target}/catalog?site=${encodeURIComponent(site)}`, {
              headers: { Accept: "application/json" },
            });
            if (!cat.ok) return next();
            const payload = parseCatalog(await cat.json());
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
          } catch {
            return next();
          }
        }
        const { path: sitePath } = splitLocale(url);
        if (
          !sitePath.startsWith("/toons/") ||
          sitePath.startsWith("/toons/editor") ||
          sitePath.startsWith("/toons/_")
        ) {
          return next();
        }
        if (sitePath === "/toons/") return next();
        const target = process.env.VITE_EDITOR_PROXY_TARGET || "http://127.0.0.1:8787";
        const site = `http://127.0.0.1:${server.config.server.port ?? 5173}`;
        try {
          const cat = await fetch(`${target}/catalog?site=${encodeURIComponent(site)}`, {
            headers: { Accept: "application/json" },
          });
          if (!cat.ok) return next();
          const payload = parseCatalog(await cat.json());
          if (!payload) return next();
          const route = matchToonRoute(url, payload);
          if (!route) return next();
          const tplRel = route.kind === "hub" ? "toons/_hub/index.html" : "toons/_reader/index.html";
          const file = path.join(srcDir, tplRel);
          if (!fs.existsSync(file)) return next();
          const raw = fs.readFileSync(file, "utf8");
          const transformed = await server.transformIndexHtml(`/${tplRel}`, raw);
          const requestUrl = `${site}${url.endsWith("/") ? url : `${url}/`}`;
          if (route.kind !== "hub" && route.kind !== "reader") return next();
          const html =
            route.kind === "hub"
              ? applyHubHtml(transformed, route.series, requestUrl)
              : applyReaderHtml(transformed, route.episode, route.series, requestUrl);
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
