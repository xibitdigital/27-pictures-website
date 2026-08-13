/**
 * Main marketing site — Vue components for chrome + contact form.
 * Static body uses CSS for magnetic (no querySelector scans).
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { initYouTubeFacades } from "./ytFacade";
import { vMagnetic } from "./directives/magnetic";

const app = createApp(SiteApp, { page: "home" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");

// Click-to-play embeds: keeps ~1MB of YouTube JS per video off first load.
initYouTubeFacades();
