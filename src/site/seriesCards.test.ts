import { describe, it, expect } from "vitest";
import { latestEpisodeHref, seriesLikeTotal } from "./seriesCards";

function card(html: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild as Element;
}

describe("latestEpisodeHref", () => {
  it("takes the last episode that has a reader", () => {
    const el = card(`
      <details class="series-card">
        <div class="episode-list">
          <a class="episode-list-item" href="/toons/erin/">EP 1</a>
          <a class="episode-list-item" href="/toons/erin-the-revenge/">EP 2</a>
          <div class="episode-list-soon">EP 3</div>
        </div>
      </details>`);

    expect(latestEpisodeHref(el)).toBe("/toons/erin-the-revenge/");
  });

  it("ignores the coming-soon card, which has no href", () => {
    const el = card(`
      <details class="series-card">
        <div class="episode-list">
          <a class="episode-list-item" href="/toons/erin/">EP 1</a>
          <div class="episode-list-soon">EP 2</div>
        </div>
      </details>`);

    expect(latestEpisodeHref(el)).toBe("/toons/erin/");
  });

  it("returns null when nothing is readable yet", () => {
    const el = card(`
      <details class="series-card">
        <div class="episode-list">
          <div class="episode-list-soon">EP 1</div>
        </div>
      </details>`);

    expect(latestEpisodeHref(el)).toBeNull();
  });
});

describe("seriesLikeTotal", () => {
  it("sums every episode in the series, not just the latest", () => {
    const likes = new Map([
      ["erin", 7],
      ["erin-the-revenge", 5],
    ]);
    expect(seriesLikeTotal("erin", likes)).toBe(12);
  });

  it("counts a single-episode series as that episode", () => {
    expect(seriesLikeTotal("nero", new Map([["nero", 3]]))).toBe(3);
  });

  it("is zero for a series with no votes, and for an unknown key", () => {
    expect(seriesLikeTotal("jax", new Map())).toBe(0);
    expect(seriesLikeTotal("nope", new Map([["jax", 9]]))).toBe(0);
  });
});
