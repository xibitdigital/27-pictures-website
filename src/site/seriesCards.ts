/**
 * Series cards on /toons/: double-click a multi-episode card to jump straight
 * to its latest episode, skipping the episode list.
 *
 * A shortcut, never the only way in. Double-click is invisible, does not exist
 * on touch, and cannot be reached from the keyboard — so the episode list stays
 * the real navigation and this only saves a click for people who find it. The
 * single-episode cards are plain links already and need nothing.
 *
 * The two clicks of a double-click toggle the <details> open and shut again
 * before `dblclick` fires, so the card is back where it started when we
 * navigate — no flicker to undo.
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
export function latestEpisodeHref(card: Element): string | null {
  const links = card.querySelectorAll<HTMLAnchorElement>(".episode-list a[href]");
  const last = links[links.length - 1];
  return last?.getAttribute("href") ?? null;
}

export function initSeriesCards(root: ParentNode = document): void {
  for (const card of root.querySelectorAll<HTMLElement>("details.series-card")) {
    const href = latestEpisodeHref(card);
    if (!href) continue;

    // Announce the shortcut to anyone who hovers; it is undiscoverable otherwise.
    const cue = card.querySelector(".series-card-cue");
    cue?.setAttribute("title", "Double-click the card to open the latest episode");

    card.addEventListener("dblclick", (event) => {
      // Inside the episode list the user has already picked a specific
      // episode — respect that rather than overriding it with the latest.
      if ((event.target as Element | null)?.closest(".episode-list")) return;
      event.preventDefault();
      window.location.href = href;
    });
  }
}
