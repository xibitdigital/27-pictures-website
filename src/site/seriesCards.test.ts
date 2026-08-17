import { describe, it, expect, vi } from "vitest";
import { latestEpisodeHref, seriesLikeTotal, initEpisodeDialogs } from "./seriesCards";

/** The shipped markup: a <details> card with the episode block inside it. */
function mountCard(): HTMLElement {
  document.body.innerHTML = `
    <div class="series-grid">
      <details class="series-card" data-series="erin">
        <summary class="series-card-face">
          <h3 class="series-card-title">Erin &amp; the Goblins</h3>
          <span class="series-card-cue">2 episodes</span>
        </summary>
        <div class="episode-block">
          <p class="episode-block-head">Episodes</p>
          <div class="series-grid">
            <a class="series-card series-card--episode" href="/toons/erin/">EP 1</a>
            <a class="series-card series-card--episode" href="/toons/erin-the-revenge/">EP 2</a>
            <div class="series-card series-card--soon">EP 3</div>
          </div>
        </div>
      </details>
      <a class="series-card series-card--single" href="/toons/nero/">Nero</a>
    </div>`;
  return document.querySelector("details.series-card") as HTMLElement;
}

describe("latestEpisodeHref", () => {
  it("takes the last episode that has a reader", () => {
    expect(latestEpisodeHref(mountCard())).toBe("/toons/erin-the-revenge/");
  });

  it("returns null when nothing is readable yet", () => {
    document.body.innerHTML = `<details class="series-card"><div class="episode-block">
      <div class="series-card series-card--soon">EP 1</div></div></details>`;
    expect(latestEpisodeHref(document.querySelector("details") as Element)).toBeNull();
  });
});

describe("seriesLikeTotal", () => {
  it("sums every episode in the series, not just the latest", () => {
    expect(
      seriesLikeTotal(
        "erin",
        new Map([
          ["erin", 7],
          ["erin-the-revenge", 5],
        ])
      )
    ).toBe(12);
  });

  it("counts a single-episode series as that episode", () => {
    expect(seriesLikeTotal("nero", new Map([["nero", 3]]))).toBe(3);
  });

  it("is zero for a series with no votes, and for an unknown key", () => {
    expect(seriesLikeTotal("jax", new Map())).toBe(0);
    expect(seriesLikeTotal("nope", new Map([["jax", 9]]))).toBe(0);
  });
});

describe("initEpisodeDialogs", () => {
  it("moves the episode list into a dialog rather than copying it", () => {
    const card = mountCard();
    initEpisodeDialogs();

    const dialog = document.querySelector("dialog.episode-dialog") as HTMLDialogElement;
    expect(dialog).toBeTruthy();
    // Exactly one copy of the links exists, and it lives in the dialog — two
    // would be duplicate content on a page indexed for them.
    expect(document.querySelectorAll(".episode-block").length).toBe(1);
    expect(dialog.querySelector(".series-grid")).toBeTruthy();
    expect(card.querySelector(".episode-block")).toBeNull();
    expect(dialog.querySelectorAll('a[href^="/toons/"]').length).toBe(2);
  });

  it("opens as a modal on the summary click, and does not expand the details", () => {
    const card = mountCard() as HTMLDetailsElement;
    initEpisodeDialogs();
    const dialog = document.querySelector("dialog.episode-dialog") as HTMLDialogElement;
    const showModal = vi.fn();
    dialog.showModal = showModal;

    (card.querySelector("summary") as HTMLElement).click();

    expect(showModal).toHaveBeenCalledOnce();
    expect(card.open).toBe(false);
  });

  it("titles the dialog after the series and announces it as a dialog trigger", () => {
    const card = mountCard();
    initEpisodeDialogs();
    const dialog = document.querySelector("dialog.episode-dialog") as HTMLDialogElement;

    expect(dialog.querySelector(".episode-dialog-title")?.textContent).toBe("Erin & the Goblins");
    expect(dialog.getAttribute("aria-label")).toContain("Erin & the Goblins");
    expect(card.querySelector("summary")?.getAttribute("aria-haspopup")).toBe("dialog");
  });

  it("leaves single-episode cards alone — they are plain links", () => {
    mountCard();
    initEpisodeDialogs();
    expect(document.querySelectorAll("dialog.episode-dialog").length).toBe(1);
    expect(document.querySelector("a.series-card--single")?.getAttribute("href")).toBe("/toons/nero/");
  });
});
