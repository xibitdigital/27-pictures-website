/**
 * A toon series page (e.g. /toons/erin-and-the-goblins/) — same Vue chrome as
 * the rest of the site. `page: "toons"` so the nav marks Toons as current: a
 * series lives under the toons index, it is not a sixth destination.
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { vMagnetic } from "./directives/magnetic";

const app = createApp(SiteApp, { page: "toons" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");
