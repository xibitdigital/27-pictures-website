/**
 * Watch page — same Vue chrome as the homepage (SiteNav + Headless UI).
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { initYouTubeFacades } from "./ytFacade";
import { vMagnetic } from "./directives/magnetic";

const app = createApp(SiteApp, { page: "watch" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");

// Click-to-play embeds — without this the placeholders render empty.
initYouTubeFacades();
