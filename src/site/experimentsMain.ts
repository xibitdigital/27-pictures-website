/**
 * Experiments lab page — same Vue chrome as the homepage (SiteNav + Headless UI).
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { vMagnetic } from "./directives/magnetic";
import { vReveal } from "./directives/reveal";

const app = createApp(SiteApp, { page: "experiments" });
app.directive("magnetic", vMagnetic);
app.directive("reveal", vReveal);
app.mount("#site-app");
