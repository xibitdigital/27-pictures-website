/**
 * Interactive toons index page — same Vue chrome as the homepage (SiteNav + Headless UI).
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { vMagnetic } from "./directives/magnetic";
import { initEpisodeDialogs, initSeriesVotes } from "./seriesCards";
import { initToonRows } from "./toonRows";

const app = createApp(SiteApp, { page: "toons" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");

// Personal + site-wide rows; both hide themselves when they have nothing to show.
initToonRows();

// Multi-episode cards open a dialog to pick an episode; without JS the list
// still expands inline, which is why this is an upgrade and not the structure.
initEpisodeDialogs();

// Series vote totals; shares the memoised likes fetch with the "most loved" row.
initSeriesVotes();
