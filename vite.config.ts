/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "src");
const distDir = path.resolve(__dirname, "dist");
const isTest = !!process.env.VITEST;

const MEDIA_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp3", ".mp4", ".webm", ".ogg", ".wav"]);

/** CDN origin without trailing slash, or empty. */
function assetBase(): string {
  return (process.env.VITE_ASSET_BASE || "").trim().replace(/\/+$/, "");
}

/**
 * Rewrite static card-art / same-origin media refs to the CDN base so experiments
 * HTML, og:image, JSON-LD, and sitemap hit R2 when VITE_ASSET_BASE is set.
 */
function rewriteStaticMediaToCdn(html: string, base: string): string {
  if (!base) return html;
  return html
    .replaceAll("https://twentyseven.pictures/card-art/", `${base}/card-art/`)
    .replaceAll('"/card-art/', `"${base}/card-art/`)
    .replaceAll("'/card-art/", `'${base}/card-art/`);
}

/**
 * When VITE_ASSET_BASE is set:
 *  - rewrite HTML card-art URLs to the CDN
 *  - drop toon media + card-art files from dist (served from R2)
 * Keeps manifests, words.json, reader CSS on Pages.
 */
function cdnMediaPlugin(): Plugin {
  return {
    name: "cdn-media",
    apply: "build",
    transformIndexHtml(html) {
      return rewriteStaticMediaToCdn(html, assetBase());
    },
    closeBundle() {
      const base = assetBase();
      if (!base) return;

      // Sitemap is copied from public/ (not an HTML entry) — rewrite in place.
      const sitemap = path.join(distDir, "sitemap.xml");
      if (fs.existsSync(sitemap)) {
        const next = rewriteStaticMediaToCdn(fs.readFileSync(sitemap, "utf8"), base);
        fs.writeFileSync(sitemap, next);
      }

      let removed = 0;
      const stripDir = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          const st = fs.statSync(full);
          if (st.isDirectory()) {
            stripDir(full);
            if (fs.existsSync(full) && fs.readdirSync(full).length === 0) fs.rmdirSync(full);
          } else if (MEDIA_EXT.has(path.extname(name).toLowerCase())) {
            fs.unlinkSync(full);
            removed += 1;
          }
        }
      };

      stripDir(path.join(distDir, "toons"));
      stripDir(path.join(distDir, "card-art"));
      if (removed) {
        console.log(`[cdn-media] removed ${removed} media file(s) from dist (served from ${base})`);
      }
    },
  };
}

/**
 * Optional HTTP Basic Auth for `vite` / `vite preview` when PROTECTED=1.
 * Pair with server.host = 127.0.0.1 so the process is not LAN-reachable.
 */
function basicAuthDevPlugin(): Plugin {
  const enabled = process.env.PROTECTED === "1" || process.env.PROTECTED === "true";
  const user = process.env.PREVIEW_USER || "dev";
  const pass = process.env.PREVIEW_PASS || "dev";

  return {
    name: "basic-auth-dev",
    configureServer(server) {
      if (!enabled) return;
      server.middlewares.use((req, res, next) => {
        if (checkBasicAuth(req.headers.authorization, user, pass)) return next();
        res.statusCode = 401;
        res.setHeader("WWW-Authenticate", 'Basic realm="27 Pictures local", charset="UTF-8"');
        res.setHeader("Cache-Control", "no-store");
        res.end("Authentication required\n");
      });
      console.log(`[basic-auth-dev] enabled user=${user} (set PREVIEW_USER / PREVIEW_PASS)`);
    },
    configurePreviewServer(server) {
      if (!enabled) return;
      server.middlewares.use((req, res, next) => {
        if (checkBasicAuth(req.headers.authorization, user, pass)) return next();
        res.statusCode = 401;
        res.setHeader("WWW-Authenticate", 'Basic realm="27 Pictures local", charset="UTF-8"');
        res.setHeader("Cache-Control", "no-store");
        res.end("Authentication required\n");
      });
    },
  };
}

function checkBasicAuth(header: string | undefined, user: string, pass: string): boolean {
  if (!header || !header.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (i < 0) return false;
    return decoded.slice(0, i) === user && decoded.slice(i + 1) === pass;
  } catch {
    return false;
  }
}

const protectedLocal =
  process.env.PROTECTED === "1" || process.env.PROTECTED === "true" || process.env.LOCAL_ONLY === "1";

/**
 * Multi-page Vue + TypeScript frontend.
 *
 * Project layout:
 *   src/                 Vite root (HTML entries + app code)
 *     index.html
 *     experiments/index.html
 *     toons/jax|erin/index.html + Vue apps
 *     site/, test/, …
 *   public/              Static assets (CSS, images, plates) → site root
 *   dist/                Build output (same URL tree as production)
 */
export default defineConfig({
  // During tests, keep project root so paths like src/**/*.test.ts resolve cleanly.
  root: isTest ? __dirname : srcDir,
  publicDir: path.resolve(__dirname, "public"),
  appType: "mpa",
  plugins: [vue(), cdnMediaPlugin(), basicAuthDevPlugin()],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(srcDir, "index.html"),
        experiments: path.resolve(srcDir, "experiments/index.html"),
        jax: path.resolve(srcDir, "toons/jax/index.html"),
        erin: path.resolve(srcDir, "toons/erin/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    // Protected / local-only modes never bind 0.0.0.0
    host: protectedLocal ? "127.0.0.1" : undefined,
    strictPort: false,
    fs: {
      // allow importing from project root if needed
      allow: [__dirname],
    },
  },
  preview: {
    port: 4173,
    host: protectedLocal ? "127.0.0.1" : undefined,
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    css: true,
  },
});
