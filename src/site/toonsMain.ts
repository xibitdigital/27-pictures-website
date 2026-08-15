/**
 * Interactive toons index page — same Vue chrome as the homepage (SiteNav + Headless UI).
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { vMagnetic } from "./directives/magnetic";
import { initSeriesCards, initSeriesVotes } from "./seriesCards";
import { initToonRows } from "./toonRows";

const app = createApp(SiteApp, { page: "toons" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");

// Personal + site-wide rows; both hide themselves when they have nothing to show.
initToonRows();

// Double-click shortcut on multi-episode cards; the episode list stays the real way in.
initSeriesCards();

// Series vote totals; shares the memoised likes fetch with the "most loved" row.
initSeriesVotes();
