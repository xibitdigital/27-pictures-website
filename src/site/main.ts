/**
 * Main marketing site — Vue components for chrome + contact form.
 * Static body uses CSS for reveal/magnetic (no querySelector scans).
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { vMagnetic } from "./directives/magnetic";
import { vReveal } from "./directives/reveal";
import { useSmoothScroll } from "./composables/useSmoothScroll";

useSmoothScroll();

const app = createApp(SiteApp, { page: "home" });
app.directive("magnetic", vMagnetic);
app.directive("reveal", vReveal);
app.mount("#site-app");
