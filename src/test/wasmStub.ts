/**
 * Stand-in for the Cloudflare-only wasm codec imports in
 * worker/toon-editor/src/imageOptimize.ts (see vite.config.ts alias).
 * Vitest runs in Node/happy-dom, which can't load a raw .wasm file the way
 * Wrangler's bundler does for the actual Worker — tests that exercise
 * toWebp() mock @jsquash/*'s decode/encode functions directly and never
 * touch this value; it only exists so importing worker/toon-editor's index.ts
 * (e.g. from readerConfig.test.ts) doesn't crash on module load.
 */
export default {} as WebAssembly.Module;
