/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cdnMediaPlugin } from "./vite/plugins/cdnMedia";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "src");
const distDir = path.resolve(__dirname, "dist");
const isTest = !!process.env.VITEST;

/**
 * Multi-page Vue + TypeScript frontend.
 *
 *   src/       Vite root (HTML entries + app code)
 *   public/    Static assets → site root
 *   dist/      Build output
 *
 * Protected local preview: `make local` / `make local-cdn` (scripts/serve-protected.js).
 * CDN: set VITE_ASSET_BASE — see vite/plugins/cdnMedia.ts.
 */
export default defineConfig({
  root: isTest ? __dirname : srcDir,
  publicDir: path.resolve(__dirname, "public"),
  appType: "mpa",
  plugins: [vue(), cdnMediaPlugin(distDir)],
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
        experiments: path.resolve(srcDir, "experiments/index.html"),
        jax: path.resolve(srcDir, "toons/jax/index.html"),
        erin: path.resolve(srcDir, "toons/erin/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
    fs: { allow: [__dirname] },
  },
  preview: {
    port: 4173,
    host: "127.0.0.1",
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    css: true,
    // Do not inherit VITE_ASSET_BASE from developer .env — unit tests use relative paths.
    env: {
      VITE_ASSET_BASE: "",
    },
  },
});
