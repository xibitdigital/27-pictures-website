/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cdnMediaPlugin } from "./vite/plugins/cdnMedia";
import { toonConfigDevPlugin } from "./vite/plugins/toonConfigDev";
import { hashedCss } from "./vite/plugins/hashedCss";
import { generateLocalePages, localePagesPlugin } from "./vite/plugins/localePages";
import fs from "node:fs";

/** Every index.html under a root, keyed by its path — "de/toons/erin". */
function htmlEntries(root: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") {
        const rel = path.relative(root, path.dirname(full));
        entries[rel === "" ? "main" : rel.split(path.sep).join("/")] = full;
      }
    }
  };
  walk(root);
  return entries;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "src");
const distDir = path.resolve(__dirname, "dist");
const isTest = !!process.env.VITEST;

// Locale HTML is generated from the English template + JSON *before* the MPA
// input scan, so `/it/toons/` is a real Vite entry. Skipped under Vitest so
// unit tests do not write into src/.
if (!isTest) generateLocalePages(srcDir);

/** Short id shown under FlipFrame on covers (override with VITE_FLIPFRAME_BUILD). */
function flipframeBuildId(): string {
  const fromEnv = process.env.VITE_FLIPFRAME_BUILD?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "dev";
  }
}

const flipframeBuild = flipframeBuildId();

/**
 * Multi-page Vue + TypeScript frontend.
 *
 *   src/       Vite root (HTML entries + app code)
 *   public/    Static assets → site root
 *   content/   Local toon config reference (dev-injected; CDN in prod)
 *   dist/      Build output
 *
 * Protected local preview: `make local` / `make local-cdn` (scripts/serve-protected.js).
 * CDN: set VITE_ASSET_BASE — see vite/plugins/cdnMedia.ts.
 */
export default defineConfig({
  // HTML/app live under src/; load .env from the repo root (VITE_ASSET_BASE, etc.)
  root: isTest ? __dirname : srcDir,
  envDir: __dirname,
  publicDir: path.resolve(__dirname, "public"),
  appType: "mpa",
  define: {
    "import.meta.env.VITE_FLIPFRAME_BUILD": JSON.stringify(flipframeBuild),
  },
  plugins: [
    // Local HTTPS for hosts name outside twentyseven.pictures (prod HSTS includeSubDomains
    // blocks self-signed certs on *.twentyseven.pictures). Use local.twentyseven.test.
    basicSsl({
      name: "local.twentyseven.test",
      domains: ["local.twentyseven.test", "localhost"],
    }),
    vue(),
    toonConfigDevPlugin(__dirname),
    cdnMediaPlugin(distDir),
    localePagesPlugin(srcDir),
    // Runs last: it rewrites the HTML cdnMediaPlugin has already touched.
    hashedCss(),
  ],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  build: {
    outDir: distDir,
    emptyOutDir: true,
    rollupOptions: {
      // Every index.html under src/ is an entry, found rather than listed. The
      // list was hand-maintained, and a page missing from it builds into
      // nothing while looking perfectly fine in the source tree — which is a
      // silent way to ship a 404. Locale landings are generated into
      // src/<locale>/ before this scan runs.
      input: htmlEntries(srcDir),
    },
  },
  server: {
    port: 5173,
    // All interfaces + custom hosts name (see /etc/hosts → local.twentyseven.test)
    host: true,
    // HTTPS certs injected by @vitejs/plugin-basic-ssl
    allowedHosts: ["local.twentyseven.test", "localhost", "127.0.0.1"],
    fs: { allow: [__dirname] },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: ["local.twentyseven.test", "localhost", "127.0.0.1"],
  },
  test: {
    environment: "happy-dom",
    globals: true,
    // vite/ is covered too: the build plugins have behaviour worth testing
    // (hashedCss decides what URL every page loads its CSS from).
    include: ["src/**/*.{test,spec}.{ts,tsx}", "vite/**/*.{test,spec}.ts"],
    setupFiles: ["src/test/setup.ts"],
    css: true,
    // Do not inherit these from developer .env — unit tests use relative paths
    // and must exercise the no-counter path unless a case stubs it.
    env: {
      VITE_ASSET_BASE: "",
      VITE_LIKES_API: "",
    },
  },
});
