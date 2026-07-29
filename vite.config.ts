/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "src");
const isTest = !!process.env.VITEST;

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
  plugins: [vue()],
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
    fs: {
      // allow importing from project root if needed
      allow: [__dirname],
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    css: true,
  },
});
