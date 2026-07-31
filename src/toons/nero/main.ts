/**
 * Nero toon — Vue + TypeScript entry.
 */
import { createApp } from "vue";
import NeroApp from "./NeroApp.vue";

createApp(NeroApp).mount("#app");

(window as unknown as { __NERO_BUILD__?: string }).__NERO_BUILD__ = "20260801a";
