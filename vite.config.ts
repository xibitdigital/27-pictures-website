/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cdnMediaPlugin } from "./vite/plugins/cdnMedia";
import { toonConfigDevPlugin } from "./vite/plugins/toonConfigDev";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "src");
const distDir = path.resolve(__dirname, "dist");
const isTest = !!process.env.VITEST;

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
      input: {
        main: path.resolve(srcDir, "index.html"),
        toons: path.resolve(srcDir, "toons/index.html"),
        cosplay: path.resolve(srcDir, "cosplay/index.html"),
        "horror-shorts": path.resolve(srcDir, "horror-shorts/index.html"),
        jax: path.resolve(srcDir, "toons/jax/index.html"),
        erin: path.resolve(srcDir, "toons/erin/index.html"),
        "erin-ep2": path.resolve(srcDir, "toons/erin-ep2/index.html"),
        nero: path.resolve(srcDir, "toons/nero/index.html"),
        "redsmile-static": path.resolve(srcDir, "toons/redsmile-static/index.html"),
      },
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
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
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
