import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractSeriesRegion, seriesLikeTotal, initSeriesQuickView } from "./seriesCards";

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
  document.querySelectorAll("dialog").forEach((d) => d.remove());
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
        "erin",
        new Map([
          ["erin", 7],
          ["erin-the-revenge", 5],
        ])
      )
    ).toBe(12);
  });

  it("is zero for a series with no votes, and for an unknown key", () => {
    expect(seriesLikeTotal("jax", new Map())).toBe(0);
    expect(seriesLikeTotal("nope", new Map([["jax", 9]]))).toBe(0);
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
