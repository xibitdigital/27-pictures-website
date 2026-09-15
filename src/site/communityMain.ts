/**
 * Creator-site chrome on toons.twentyseven.pictures — catalog home and portfolios.
 * Shelf cards are SSR. Continue-reading and series votes wait on D1 catalog.
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { vMagnetic } from "./directives/magnetic";
import { rememberDocumentLocale } from "./i18n";
import { initSeriesQuickView } from "./seriesCards";
import { initToonCatalog } from "./toonCatalog";

rememberDocumentLocale();

const app = createApp(SiteApp, { page: "community" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");

void initToonCatalog();
initSeriesQuickView();
