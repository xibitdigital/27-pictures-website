/**
 * Jax toon — Vue + TypeScript entry.
 */
import { createApp } from "vue";
import JaxApp from "./JaxApp.vue";

createApp(JaxApp).mount("#app");

// Keep a stable runtime marker in the entry chunk. Cloudflare may cache
// `/assets/*` for 1 year (immutable). If an edge ever stores text/html for a
// fingerprinted .js URL (SPA/CORS race), that hash is dead forever — bump this
// string so Vite emits a new filename and the page boots again.
(window as unknown as { __JAX_BUILD__?: string }).__JAX_BUILD__ = "20260729a";
