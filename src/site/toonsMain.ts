/**
 * Interactive toons index page — same Vue chrome as the homepage (SiteNav + Headless UI).
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { vMagnetic } from "./directives/magnetic";
import { rememberDocumentLocale } from "./i18n";
import { initSeriesQuickView, initSeriesVotes } from "./seriesCards";
import { initToonRows } from "./toonRows";

// So a reader opened from /it/toons/ starts with Italian captions, even though
// the book itself lives at the English URL.
rememberDocumentLocale();

const app = createApp(SiteApp, { page: "toons" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");

// Personal + site-wide rows; both hide themselves when they have nothing to show.
initToonRows();

// Multi-episode cards link to their series page; this shows that page in a
// dialog instead. Without JS the link simply navigates.
initSeriesQuickView();

// Series vote totals; shares the memoised likes fetch with the "most loved" row.
initSeriesVotes();
