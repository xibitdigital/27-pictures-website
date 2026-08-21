/**
 * A toon series page (e.g. /toons/erin-and-the-goblins/) — same Vue chrome as
 * the rest of the site. `page: "toons"` so the nav marks Toons as current: a
 * series lives under the toons index, it is not a sixth destination.
 */
import { createApp } from "vue";
import SiteApp from "./SiteApp.vue";
import { vMagnetic } from "./directives/magnetic";
import { rememberDocumentLocale } from "./i18n";
import { SERIES } from "../toons/series";
import { initEpisodeVotes } from "./seriesCards";

rememberDocumentLocale();

/**
 * Deep links survive the series taking the clean URL.
 *
 * `/toons/nero/` and `/toons/jax/` used to be the readers, and their READMEs
 * document `?page=N` deep links. Those URLs are now series pages, so an old
 * link would land on a page with no reader on it. Anything carrying `?page=`
 * is therefore forwarded to episode one, query and hash intact.
 *
 * `replace`, not `assign`: the series page was never somewhere the reader
 * meant to be, so it should not sit in history behind the back button.
 */
const seriesKey = document.documentElement.dataset.seriesKey;
if (seriesKey) {
  const params = new URLSearchParams(window.location.search);
  if (params.has("page")) {
    const episodeOne = SERIES.find((s) => s.key === seriesKey)?.episodes.find((e) => e.url);
    if (episodeOne?.url) {
      window.location.replace(`${episodeOne.url}${window.location.search}${window.location.hash}`);
    }
  }
}

const app = createApp(SiteApp, { page: "toons" });
app.directive("magnetic", vMagnetic);
app.mount("#site-app");

// Vote counts per episode — silent until the Worker answers, absent at zero.
initEpisodeVotes();
