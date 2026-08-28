/**
 * Continue reading on /toons/ — per-visitor, from localStorage the readers write.
 * The row stays hidden until there is a book to resume.
 */
import { allEpisodes, episodeLabel, type Episode } from "../toons/series";
import { readProgress, type ReadingProgress } from "../toons/bookReader/readingProgress";
import { documentLocale, UI, withCaptionLang } from "./i18n";

export interface RowLabels {
  pageOf: string;
}

function defaultLabels(): RowLabels {
  return { pageOf: UI[documentLocale()].pageOf };
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export type RowEpisode = Episode & { seriesTitle: string; coverUrl?: string };

const ASSET_BASE = (import.meta.env.VITE_ASSET_BASE as string | undefined) || "";

function artUrl(ep: RowEpisode): string {
  if (ep.coverUrl) return ep.coverUrl;
  return ep.art ? `${ASSET_BASE}/card-art/${ep.art}` : "";
}

function tile(ep: RowEpisode, meta: string, extra = ""): string {
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
  episodes: RowEpisode[],
  read: (id: string) => ReadingProgress | null = readProgress,
  labels: RowLabels = defaultLabels()
): string[] {
  return episodes
    .map((ep) => ({ ep, progress: ep.id ? read(ep.id) : null }))
    .filter((row): row is { ep: RowEpisode; progress: ReadingProgress } => row.progress !== null)
    .sort((a, b) => b.progress.at - a.progress.at)
    .map(({ ep, progress }) => {
      const pct = Math.round((progress.page / progress.pages) * 100);
      const bar = `<span class="episode-tile-progress" style="--read: ${pct}%"></span>`;
      const meta = fill(labels.pageOf, { page: progress.page, pages: progress.pages });
      return tile({ ...ep, url: `${ep.url}?page=${progress.page}` }, meta, bar);
    });
}

export function initToonRows(episodes: RowEpisode[] = allEpisodes()): void {
  const resume = document.getElementById("continue-reading");
  if (resume) renderRow(resume, continueReadingTiles(episodes));
}
