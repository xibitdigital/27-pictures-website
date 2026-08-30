import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractSeriesRegion,
  seriesLikeTotal,
  initSeriesQuickView,
  initEpisodeVotes,
  resetSeriesQuickView,
  setSeriesEpisodeMarkup,
  fillSeriesEpisodeGrid,
} from "./seriesCards";
import { resetLikesCache, fetchLikes } from "./likes";

vi.mock("./likes", async (orig) => ({
  ...(await orig<typeof import("./likes")>()),
  fetchLikes: vi.fn(),
}));

const SERIES_PAGE = `<!doctype html><html><head><title>Erin</title></head><body>
  <div id="site-app">nav goes here</div>
  <main>
    <nav class="sr-only-seo">breadcrumb</nav>
    <div data-series-page>
      <header class="series-header"><h1>Erin &amp; the Goblins</h1></header>
      <a class="series-card" href="/toons/erin/">EP 1</a>
      <a class="series-card" href="/toons/erin-the-revenge/">EP 2</a>
    </div>
    <footer class="page-footer">footer goes here</footer>
  </main></body></html>`;

function mountIndex(): HTMLAnchorElement {
  document.body.innerHTML = `
    <div class="series-grid">
      <a class="series-card series-card--series" data-quick-view href="/toons/erin-and-the-goblins/">Erin</a>
      <a class="series-card series-card--single" href="/toons/nero/">Nero</a>
    </div>`;
  return document.querySelector("a[data-quick-view]") as HTMLAnchorElement;
}

beforeEach(() => {
  vi.restoreAllMocks();
  resetLikesCache();
  resetSeriesQuickView();
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

describe("fillSeriesEpisodeGrid", () => {
  it("fills an empty grid from catalog markup", () => {
    document.body.innerHTML = `<div data-series-page>
      <div class="series-grid" data-series-episodes></div>
    </div>`;
    setSeriesEpisodeMarkup(
      new Map([["red-smile", `<a class="series-card series-card--episode" href="/toons/redsmile-static/">static</a>`]])
    );
    fillSeriesEpisodeGrid(document.body, "red-smile");
    const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/toons/redsmile-static/"]);
  });

  it("leaves SSR cards alone", () => {
    document.body.innerHTML = `<div data-series-page>
      <div class="series-grid" data-series-episodes>
        <a class="series-card series-card--episode" href="/toons/redsmile-static/">static</a>
        <a class="series-card series-card--episode" href="/toons/redsmile-marcus/">Marcus</a>
      </div>
    </div>`;
    setSeriesEpisodeMarkup(
      new Map([["red-smile", `<a class="series-card series-card--episode" href="/toons/redsmile-static/">static</a>`]])
    );
    fillSeriesEpisodeGrid(document.body, "red-smile");
    const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/toons/redsmile-static/", "/toons/redsmile-marcus/"]);
  });
});

describe("extractSeriesRegion", () => {
  it("takes the page's quick-view region and nothing around it", () => {
    const region = extractSeriesRegion(SERIES_PAGE);
    const host = document.createElement("div");
    host.append(region as DocumentFragment);

    expect(host.querySelectorAll('a[href^="/toons/"]').length).toBe(2);
    expect(host.querySelector("h1")?.textContent).toBe("Erin & the Goblins");
    // The nav and footer are excluded by construction, not by a second render mode.
    expect(host.textContent).not.toContain("nav goes here");
    expect(host.textContent).not.toContain("footer goes here");
    expect(host.querySelector(".page-footer")).toBeNull();
  });

  it("returns null for a page with no region, so the caller can navigate", () => {
    expect(extractSeriesRegion("<html><body><main>plain page</main></body></html>")).toBeNull();
  });
});

describe("seriesLikeTotal", () => {
  it("sums every episode in the series, not just the latest", () => {
    expect(
      seriesLikeTotal(
        ["erin", "erin-the-revenge"],
        new Map([
          ["erin", 7],
          ["erin-the-revenge", 5],
        ])
      )
    ).toBe(12);
  });

  it("is zero for a series with no votes, and for an empty slug list", () => {
    expect(seriesLikeTotal(["jax"], new Map())).toBe(0);
    expect(seriesLikeTotal([], new Map([["jax", 9]]))).toBe(0);
  });
});

describe("initSeriesQuickView", () => {
  it("shows the fetched page in a dialog instead of navigating", async () => {
    const trigger = mountIndex();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(SERIES_PAGE, { status: 200 }));
    initSeriesQuickView();

    const showModal = vi.fn();
    HTMLDialogElement.prototype.showModal = showModal;
    trigger.click();
    await vi.waitFor(() => expect(showModal).toHaveBeenCalled());

    const body = document.querySelector(".episode-dialog-body") as HTMLElement;
    expect(body.querySelectorAll('a[href^="/toons/"]').length).toBe(2);
    expect(body.textContent).not.toContain("footer goes here");
  });

  it("fetches once and reuses the result on reopen", async () => {
    const trigger = mountIndex();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(SERIES_PAGE, { status: 200 }));
    HTMLDialogElement.prototype.showModal = vi.fn();
    initSeriesQuickView();

    trigger.click();
    await vi.waitFor(() => expect(document.querySelector(".episode-dialog-body a")).toBeTruthy());
    trigger.click();
    trigger.click();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to navigating when the fetch fails", async () => {
    const trigger = mountIndex();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    HTMLDialogElement.prototype.showModal = vi.fn();
    initSeriesQuickView();

    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        set href(v: string) {
          assign(v);
        },
      },
      writable: true,
    });

    trigger.click();
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/toons/erin-and-the-goblins/"));
  });

  it("leaves modified clicks to the browser, so new-tab still works", () => {
    const trigger = mountIndex();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    initSeriesQuickView();

    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores cards that are not quick-view triggers", () => {
    mountIndex();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    initSeriesQuickView();
    (document.querySelector("a.series-card--single") as HTMLElement).click();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("initEpisodeVotes", () => {
  /**
   * Stub the counts at the module boundary, not at `fetch`: Vitest forces
   * VITE_LIKES_API empty, so `likesApiBase()` is null and the real loader
   * returns an empty map without ever calling fetch.
   */
  function stubLikes(counts: Record<string, number>): void {
    vi.mocked(fetchLikes).mockResolvedValue(new Map(Object.entries(counts)));
  }

  it("prints each episode's own count, not the series total", async () => {
    document.body.innerHTML = `
      <span class="series-card-votes" data-votes-episode="erin" hidden></span>
      <span class="series-card-votes" data-votes-episode="erin-the-revenge" hidden></span>`;
    stubLikes({ erin: 7, "erin-the-revenge": 5 });

    initEpisodeVotes();
    await vi.waitFor(() => {
      const [ep1, ep2] = [...document.querySelectorAll<HTMLElement>("[data-votes-episode]")];
      expect(ep1.textContent).toBe("7 votes");
      expect(ep2.textContent).toBe("5 votes");
      expect(ep1.hidden).toBe(false);
    });
  });

  it("leaves an episode with no votes hidden and empty", async () => {
    document.body.innerHTML = `<span data-votes-episode="jax" hidden></span>`;
    stubLikes({});

    initEpisodeVotes();
    await new Promise((r) => setTimeout(r, 10));
    const slot = document.querySelector<HTMLElement>("[data-votes-episode]")!;
    expect(slot.hidden).toBe(true);
    expect(slot.textContent).toBe("");
  });

  it("uses the singular for one vote", async () => {
    document.body.innerHTML = `<span data-votes-episode="nero" hidden></span>`;
    stubLikes({ nero: 1 });

    initEpisodeVotes();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("[data-votes-episode]")!.textContent).toBe("1 vote")
    );
  });
});
