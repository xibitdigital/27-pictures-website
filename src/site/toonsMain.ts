/**
 * Interactive toons index page — same Vue chrome as the homepage (SiteNav + Headless UI).
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { vMagnetic } from "./directives/magnetic";
import { initToonRows } from "./toonRows";

const app = createApp(SiteApp, { page: "toons" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");

// Personal + site-wide rows; both hide themselves when they have nothing to show.
initToonRows();
