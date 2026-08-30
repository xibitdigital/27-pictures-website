/**
 * Dev-only: stamp D1 catalog cards into /toons/ HTML the same way the Pages
 * Function does in production. `vite build` leaves the grids empty; Cloudflare
 * injects at request time.
 */
import type { Plugin } from "vite";
import { parseCatalog } from "../../src/site/catalogRender";
import { injectToonHtml } from "../../functions/toonSsr";

export function toonSsrDevPlugin(): Plugin {
  return {
    name: "toon-ssr-dev",
    transformIndexHtml: {
      order: "post",
      async handler(html, ctx) {
        if (!ctx.server) return html;
        if (!html.includes("data-toon-catalog") && !html.includes("data-series-jsonld")) return html;
        const target = process.env.VITE_EDITOR_PROXY_TARGET || "http://127.0.0.1:8787";
        const path = (ctx.originalUrl || ctx.path || "/").split("?")[0];
        const site = `http://127.0.0.1:${ctx.server.config.server.port ?? 5173}`;
        try {
          const res = await fetch(`${target}/catalog?site=${encodeURIComponent(site)}`, {
            headers: { Accept: "application/json" },
          });
          if (!res.ok) return html;
          const payload = parseCatalog(await res.json());
          if (!payload) return html;
          return injectToonHtml(html, payload, `${site}${path.startsWith("/") ? path : `/${path}`}`);
        } catch {
          return html;
        }
      },
    },
  };
}
