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
      slot.textContent = `${total} ${total === 1 ? "vote" : "votes"}`;
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

  dialog.append(close, body);
  // The dialog's own box is a child, so a click on the element itself can only
  // have landed on the backdrop.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.body.append(dialog);
  return dialog;
}

export function initSeriesQuickView(root: ParentNode = document): void {
  const triggers = [...root.querySelectorAll<HTMLAnchorElement>("a[data-quick-view]")];
  if (!triggers.length || typeof HTMLDialogElement === "undefined") return;

  let dialog: HTMLDialogElement | null = null;
  const cache = new Map<string, DocumentFragment>();

  for (const trigger of triggers) {
    trigger.addEventListener("click", (event) => {
      // Leave new-tab, middle-click and modified clicks alone — a quick view
      // must not hijack the ways people deliberately open a real page.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

      const href = trigger.getAttribute("href");
      if (!href) return;
      event.preventDefault();

      const view = (dialog ??= buildDialog());
      const body = view.querySelector(".episode-dialog-body") as HTMLElement;
      const show = (content: Node) => {
        body.replaceChildren(content);
        view.showModal();
        // Focus the first episode, not the close button that showModal() would
        // otherwise pick: opening the view should not highlight "dismiss".
        body.querySelector<HTMLAnchorElement>("a[href]")?.focus();
      };

      const cached = cache.get(href);
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
          cache.set(href, region);
          show(region.cloneNode(true));
        })
        .catch(() => {
          // Whatever failed, the link still works — go to the real page.
          window.location.href = href;
        })
        .finally(() => view.classList.remove("is-loading"));
    });
  }
}
