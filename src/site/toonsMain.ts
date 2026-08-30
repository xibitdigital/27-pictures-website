/**
 * Interactive toons index page — same Vue chrome as the homepage (SiteNav + Headless UI).
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { vMagnetic } from "./directives/magnetic";
import { rememberDocumentLocale } from "./i18n";
import { initSeriesQuickView } from "./seriesCards";
import { initToonCatalog } from "./toonCatalog";

// So a reader opened from /it/toons/ starts with Italian captions, even though
// the book itself lives at the English URL.
rememberDocumentLocale();

const app = createApp(SiteApp, { page: "toons" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");

// Shelf cards are SSR. Continue-reading and series votes wait on D1 catalog.
void initToonCatalog();

// Multi-episode cards link to their series page; this shows that page in a
// dialog instead. Without JS the link simply navigates.
initSeriesQuickView();
