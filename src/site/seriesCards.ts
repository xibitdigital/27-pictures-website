/**
 * Series cards on /toons/.
 *
 * A card for a series with several episodes links to that series' own page. With
 * JS the click is intercepted and the page is shown in a dialog instead — the
 * quick view — so choosing an episode does not cost a page load and does not
 * lose your place on the index.
 *
 * The link is the structure and the dialog is the enhancement, in that order:
 *
 *   - no JS, or the fetch fails, or the browser has no <dialog>: the click is a
 *     plain navigation to a real page. Nothing is trapped behind script.
 *   - crawlers follow the same link to a page whose content is visible, rather
 *     than reading episode markup out of a closed dialog, where it renders as
 *     display:none and is weighted lower than visible text.
 *
 * The dialog shows the page's own `[data-series-page]` region, which leaves out
 * the nav and the footer by construction. A separate "bare" render mode would be
 * a second code path for the same content, free to drift from the real page.
 */

import { fetchLikes } from "./likes";
import { SERIES } from "../toons/series";
import { documentLocale, UI, withCaptionLang } from "./i18n";

/**
 * A series card shows the whole series' hearts, not one book's — the card
 * stands for the series, and on a multi-episode book a single episode's count
 * would read as the series total and undercount it.
 */
export function seriesLikeTotal(key: string, likes: Map<string, number>): number {
  const series = SERIES.find((s) => s.key === key);
  if (!series) return 0;
  return series.episodes.reduce((sum, ep) => sum + (ep.id ? likes.get(ep.id) ?? 0 : 0), 0);
}

/** Fills the vote badges once the counts arrive; silent when there are none. */
export function initSeriesVotes(root: ParentNode = document): void {
  const slots = [...root.querySelectorAll<HTMLElement>("[data-votes-for]")];
  if (!slots.length) return;

  const ids = SERIES.flatMap((s) => s.episodes.map((e) => e.id).filter((id): id is string => Boolean(id)));

  void fetchLikes(ids).then((likes) => {
    for (const slot of slots) {
      const total = seriesLikeTotal(slot.dataset.votesFor as string, likes);
      if (total <= 0) continue;
      const ui = UI[documentLocale()];
      slot.textContent = `${total} ${total === 1 ? ui.vote : ui.votes}`;
      slot.hidden = false;
    }
  });
}

/**
 * Fills the per-episode vote badges on a series page — or on the copy of it
 * injected into the quick-view dialog, which is why this takes a root.
 *
 * Per episode, not per series: on a series page each row *is* one book, so the
 * series total that the /toons/ card shows would be the same number printed
 * against every episode.
 */
export function initEpisodeVotes(root: ParentNode = document): void {
  const slots = [...root.querySelectorAll<HTMLElement>("[data-votes-episode]")];
  if (!slots.length) return;

  const ids = SERIES.flatMap((s) => s.episodes.map((e) => e.id).filter((id): id is string => Boolean(id)));

  void fetchLikes(ids).then((likes) => {
    const ui = UI[documentLocale()];
    for (const slot of slots) {
      const total = likes.get(slot.dataset.votesEpisode as string) ?? 0;
      if (total <= 0) continue;
      slot.textContent = `${total} ${total === 1 ? ui.vote : ui.votes}`;
      slot.hidden = false;
    }
  });
}

/**
 * Pulls the quick-view region out of a fetched series page. Null when the page
 * has no such region — the caller then navigates rather than opening an empty
 * dialog.
 */
export function extractSeriesRegion(html: string): DocumentFragment | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const region = doc.querySelector("[data-series-page]");
  if (!region) return null;
  for (const a of region.querySelectorAll<HTMLAnchorElement>('a[href^="/toons/"]')) {
    a.setAttribute("href", withCaptionLang(a.getAttribute("href") || ""));
  }
  const fragment = document.createDocumentFragment();
  fragment.append(...Array.from(region.childNodes));
  return fragment;
}

function buildDialog(): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "episode-dialog";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "episode-dialog-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "✕";
  close.addEventListener("click", () => dialog.close());

  const body = document.createElement("div");
  body.className = "episode-dialog-body";
  body.tabIndex = -1;

  dialog.append(close, body);
  // The dialog's own box is a child, so a click on the element itself can only
  // have landed on the backdrop.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.body.append(dialog);
  return dialog;
}

/**
 * One listener on the document so catalog-swapped series cards still open
 * the quick view. Per-card listeners die when the grid is rebuilt from D1.
 */
let quickViewBound = false;
let quickViewDialog: HTMLDialogElement | null = null;
const quickViewCache = new Map<string, DocumentFragment>();
/** D1 catalog markup per series key — drafts never included. */
let seriesEpisodeMarkup = new Map<string, string>();
/** Full D1 apply (title, lead, cards). Set by `initToonCatalog`. */
let seriesFill: ((root: ParentNode, seriesKey: string) => boolean) | null = null;

export function setSeriesEpisodeMarkup(bySeries: Map<string, string>): void {
  seriesEpisodeMarkup = bySeries;
}

export function setSeriesFill(fn: ((root: ParentNode, seriesKey: string) => boolean) | null): void {
  seriesFill = fn;
}

/** Fill a series grid from the catalog. Empty string clears leftover static cards. */
export function fillSeriesEpisodeGrid(root: ParentNode, seriesKey: string): void {
  const grid = root.querySelector("[data-series-episodes]") || root.querySelector(".series-grid");
  if (grid?.querySelector(".series-card")) return;
  if (seriesFill?.(root, seriesKey)) return;
  const html = seriesEpisodeMarkup.get(seriesKey);
  if (!grid || html === undefined) return;
  grid.innerHTML = html;
}

/** Tests: drop cached pages and the dialog node after each case. */
export function resetSeriesQuickView(): void {
  quickViewCache.clear();
  quickViewDialog = null;
  seriesEpisodeMarkup = new Map();
  seriesFill = null;
}

export function initSeriesQuickView(_root: ParentNode = document): void {
  if (quickViewBound || typeof HTMLDialogElement === "undefined") return;
  quickViewBound = true;

  document.addEventListener("click", (event) => {
    // Leave new-tab, middle-click and modified clicks alone — a quick view
    // must not hijack the ways people deliberately open a real page.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest<HTMLAnchorElement>("a[data-quick-view]");
    if (!trigger || !document.contains(trigger)) return;
    if (event.button !== 0) return;

    const href = trigger.getAttribute("href");
    if (!href) return;
    event.preventDefault();

    const view = (quickViewDialog ??= buildDialog());
    const body = view.querySelector(".episode-dialog-body") as HTMLElement;
    const show = (content: Node) => {
      body.replaceChildren(content);
      const seriesKey = trigger.getAttribute("data-series") || "";
      if (seriesKey) fillSeriesEpisodeGrid(body, seriesKey);
      // The badges are filled on the injected copy, not on the cached
      // fragment: `show` clones it, so a fragment filled once would keep a
      // stale count for the rest of the session.
      initEpisodeVotes(body);
      view.showModal();
      // Focus the panel, not the close button showModal() would otherwise pick
      // and not the first episode either: focusing a card drew a ring around
      // episode one, which reads as "this one is selected" rather than "the
      // dialog is open". From here Tab still reaches every episode in order.
      body.focus();
    };

    const cached = quickViewCache.get(href);
    if (cached) {
      show(cached.cloneNode(true));
      return;
    }

    view.classList.add("is-loading");
    void fetch(href, { headers: { Accept: "text/html" } })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then((html) => {
        const region = extractSeriesRegion(html);
        if (!region) throw new Error("no series region");
        quickViewCache.set(href, region);
        show(region.cloneNode(true));
      })
      .catch(() => {
        // Whatever failed, the link still works — go to the real page.
        window.location.href = href;
      })
      .finally(() => view.classList.remove("is-loading"));
  });
}
