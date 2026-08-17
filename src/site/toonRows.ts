/**
 * The two rows on /toons/ that cannot be static HTML.
 *
 * - **Continue reading** — per-visitor, from localStorage the readers write.
 * - **Most loved** — per-site, from the likes Worker (KV).
 *
 * Both are additive: the page ships complete without them, and each row only
 * appears once it has something true to say. A row that would show "no
 * progress yet" or an empty ranking is worse than no row.
 */
import { fetchLikes } from "./likes";
import { allEpisodes, episodeLabel, type Episode } from "../toons/series";
import { readProgress, type ReadingProgress } from "../toons/bookReader/readingProgress";
import { documentLocale, UI, withCaptionLang } from "./i18n";

export interface RowLabels {
  pageOf: string;
  pagesCount: string;
}

function defaultLabels(): RowLabels {
  const ui = UI[documentLocale()];
  return { pageOf: ui.pageOf, pagesCount: ui.pagesCount };
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

type SeriesEpisode = Episode & { seriesTitle: string };

const ASSET_BASE = (import.meta.env.VITE_ASSET_BASE as string | undefined) || "";

function artUrl(ep: SeriesEpisode): string {
  return ep.art ? `${ASSET_BASE}/card-art/${ep.art}` : "";
}

function tile(ep: SeriesEpisode, meta: string, extra = ""): string {
  const id = `row-${ep.id}-title`;
  const art = artUrl(ep);
  const img = art
    ? `<img src="${art}" alt="${ep.seriesTitle} — ${ep.title} cover art" width="1152" height="1728" loading="lazy" decoding="async" />`
    : "";
  return `<article>
    <a href="${withCaptionLang(ep.url ?? "")}" class="episode-tile" aria-labelledby="${id}">
      <span class="episode-tile-art">${img}${extra}</span>
      <span class="episode-tile-meta">${meta}</span>
      <h3 id="${id}">${ep.title}</h3>
      <span class="episode-tile-desc">${episodeLabel(ep)}</span>
    </a>
  </article>`;
}

function renderRow(host: HTMLElement, tiles: string[]): void {
  if (!tiles.length) return;
  const grid = host.querySelector<HTMLElement>(".experiments-grid");
  if (!grid) return;
  grid.innerHTML = tiles.join("\n");
  host.hidden = false;
}

/** Ordered by how recently the book was read, most recent first. */
export function continueReadingTiles(
  episodes: SeriesEpisode[],
  read: (id: string) => ReadingProgress | null = readProgress,
  labels: RowLabels = defaultLabels()
): string[] {
  return episodes
    .map((ep) => ({ ep, progress: ep.id ? read(ep.id) : null }))
    .filter((row): row is { ep: SeriesEpisode; progress: ReadingProgress } => row.progress !== null)
    .sort((a, b) => b.progress.at - a.progress.at)
    .map(({ ep, progress }) => {
      const pct = Math.round((progress.page / progress.pages) * 100);
      const bar = `<span class="episode-tile-progress" style="--read: ${pct}%"></span>`;
      const meta = fill(labels.pageOf, { page: progress.page, pages: progress.pages });
      return tile({ ...ep, url: `${ep.url}?page=${progress.page}` }, meta, bar);
    });
}

/**
 * Most hearts first; ties keep series order. Books with no votes are left out.
 *
 * The count ranks the row but is not printed on it: the heading already says
 * these are ranked by hearts, and a tile reading "1 heart" undersells a book
 * rather than recommending it. The tile shows its length instead, which is
 * what someone deciding what to read next actually wants.
 */
export function mostLovedTiles(
  episodes: SeriesEpisode[],
  likes: Map<string, number>,
  labels: RowLabels = defaultLabels()
): string[] {
  return episodes
    .filter((ep) => (likes.get(ep.id as string) ?? 0) > 0)
    .sort((a, b) => (likes.get(b.id as string) ?? 0) - (likes.get(a.id as string) ?? 0))
    .map((ep) => tile(ep, fill(labels.pagesCount, { n: ep.pages ?? 0 })));
}

export function initToonRows(): void {
  const episodes = allEpisodes();

  const resume = document.getElementById("continue-reading");
  if (resume) renderRow(resume, continueReadingTiles(episodes));

  const loved = document.getElementById("most-loved");
  if (loved) {
    void fetchLikes(episodes.map((ep) => ep.id as string)).then((likes) =>
      renderRow(loved, mostLovedTiles(episodes, likes))
    );
  }
}
