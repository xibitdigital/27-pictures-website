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

/**
 * Site-root paths under /toons/… that static HTML/XML still reference
 * (experiment cards, og:image, JSON-LD, sitemap). These must stay on Pages
 * even when bulk reader media is offloaded to R2.
 */
function collectToonMediaKeepList(root: string): Set<string> {
  const keep = new Set<string>();
  const re = /(?:https?:\/\/[^"'/\s]+)?(\/toons\/[^"'?\s#]+\.(?:jpe?g|png|webp|gif|mp3|mp4|webm|ogg|wav))/gi;

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(html?|xml|json|txt)$/i.test(name)) continue;
      let text: string;
      try {
        text = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      for (const m of text.matchAll(re)) {
        // "/toons/erin/assets/x.jpg" → "toons/erin/assets/x.jpg"
        keep.add(m[1].replace(/^\//, ""));
      }
    }
  };

  walk(root);
  return keep;
}

/**
 * When VITE_ASSET_BASE is set, drop toon media from dist/ after the public/
 * copy — those files are served from R2/CDN instead of Pages.
 * Keeps manifest.json, words.json, reader CSS, and any media still referenced
 * from static HTML/XML (e.g. experiments card thumbs, og:image).
 */
function stripToonMediaWhenCdn(): Plugin {
  return {
    name: "strip-toon-media-when-cdn",
    apply: "build",
    closeBundle() {
      const base = (process.env.VITE_ASSET_BASE || "").trim();
      if (!base) return;
      const toonsDir = path.join(distDir, "toons");
      if (!fs.existsSync(toonsDir)) return;

      const keep = collectToonMediaKeepList(distDir);
      let removed = 0;
      let kept = 0;
      const walk = (dir: string) => {
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          const st = fs.statSync(full);
          if (st.isDirectory()) {
            walk(full);
            // Remove empty dirs left behind (e.g. assets/sfx)
            if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
          } else if (MEDIA_EXT.has(path.extname(name).toLowerCase())) {
            const rel = path.relative(distDir, full).split(path.sep).join("/");
            if (keep.has(rel)) {
              kept += 1;
              continue;
            }
            fs.unlinkSync(full);
            removed += 1;
          }
        }
      };
      walk(toonsDir);
      if (removed || kept) {
        console.log(
          `[strip-toon-media-when-cdn] removed ${removed} media file(s) from dist/toons; kept ${kept} (HTML/sitemap refs)`
        );
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
  plugins: [vue(), stripToonMediaWhenCdn(), basicAuthDevPlugin()],
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
