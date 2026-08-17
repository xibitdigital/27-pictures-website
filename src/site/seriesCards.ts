/**
 * Series cards on /toons/.
 *
 * A card with several episodes opens a dialog to pick one; a card with a single
 * episode is a plain link and needs nothing. The picker is an enhancement, not
 * the structure: the markup ships as <details> with the episode list inside it,
 * so with scripting off the list still expands in place and the links are still
 * there for crawlers. When JS runs, the list moves into a <dialog> and the
 * summary opens that instead.
 *
 * Native <dialog> rather than a hand-built overlay: showModal() brings the
 * backdrop, Escape, the focus trap and inert-ing the page behind it, all of
 * which a div would have to reimplement badly.
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

/** Latest = the last episode in series order that actually has a reader. */
export function latestEpisodeHref(scope: Element): string | null {
  // Scoped to the block, not to a list or grid class: the picker's markup has
  // changed shape twice and this should not have to change with it.
  const links = scope.querySelectorAll<HTMLAnchorElement>(".episode-block a[href]");
  const last = links[links.length - 1];
  return last?.getAttribute("href") ?? null;
}

/** The series title, for the dialog heading. Falls back to a generic label. */
function seriesTitle(card: Element): string {
  return card.querySelector(".series-card-title")?.textContent?.trim() || "Episodes";
}

function buildDialog(card: Element, block: Element): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "episode-dialog";
  dialog.setAttribute("aria-label", `${seriesTitle(card)} — choose an episode`);

  const head = document.createElement("div");
  head.className = "episode-dialog-head";

  const title = document.createElement("p");
  title.className = "episode-dialog-title";
  title.textContent = seriesTitle(card);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "episode-dialog-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "✕";

  head.append(title, close);
  // The list is moved, not copied: two copies of the same episode links would
  // be duplicate content on a page that is indexed for them.
  dialog.append(head, block);

  close.addEventListener("click", () => dialog.close());

  // Clicking the backdrop closes. The dialog's own box is a child, so a click
  // landing on the element itself can only have hit the backdrop.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  return dialog;
}

export function initEpisodeDialogs(root: ParentNode = document): void {
  for (const card of root.querySelectorAll<HTMLDetailsElement>("details.series-card")) {
    const block = card.querySelector(".episode-block");
    const summary = card.querySelector<HTMLElement>("summary");
    if (!block || !summary || typeof HTMLDialogElement === "undefined") continue;

    const dialog = buildDialog(card, block);
    card.after(dialog);

    // The card is now a trigger, not a disclosure — say so to assistive tech,
    // which would otherwise announce an expandable section that never expands.
    summary.setAttribute("role", "button");
    summary.setAttribute("aria-haspopup", "dialog");

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      // A <details> whose content has moved out has nothing to show; keep it
      // shut so the arrow does not flip on a card that never expands.
      card.open = false;
      dialog.showModal();
    });
  }
}
