/**
 * Cosplay service page — same Vue chrome as the homepage (SiteNav + Headless UI).
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { initYouTubeFacades } from "./ytFacade";
import { vMagnetic } from "./directives/magnetic";

const app = createApp(SiteApp, { page: "cosplay" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");

// Click-to-play embeds — see src/site/ytFacade.ts.
initYouTubeFacades();
