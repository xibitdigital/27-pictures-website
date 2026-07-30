/**
 * Dev-only: serve content/toons/<toon>/config.json at
 *   /__dev/toon-config/<toon>.json
 *
 * Production readers load hashed config from CDN via config-lock.json.
 * Local `vite` / `make dev` always hit the editable reference file.
 */
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";

const DEV_CONFIG_RE = /^\/__dev\/toon-config\/([a-z0-9_-]+)\.json(?:\?.*)?$/i;

export function toonConfigDevPlugin(projectRoot: string): Plugin {
  const contentToons = path.join(projectRoot, "content", "toons");

  function middleware(req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) {
    const url = req.url || "";
    const m = url.match(DEV_CONFIG_RE);
    if (!m) {
      next();
      return;
    }

    const toon = m[1].toLowerCase();
    const file = path.join(contentToons, toon, "config.json");
    if (!fs.existsSync(file)) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(`No reference config: content/toons/${toon}/config.json`);
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(file).pipe(res);
  }

  return {
    name: "toon-config-dev",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    // Also useful for `vite preview` when iterating without R2 config.
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

/** Path apps should fetch in dev (must match middleware). */
export function devToonConfigPath(toon: string): string {
  return `/__dev/toon-config/${toon}.json`;
}

export function isDevToonConfigPath(url: string): boolean {
  return DEV_CONFIG_RE.test(url.split("?")[0] || "");
}
