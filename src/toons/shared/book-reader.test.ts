import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initToonBook } from "./book-reader";
import {
  mountBookFixture,
  stubReaderMatchMedia,
  stubImagePreload,
  stubManifestFetch,
  FOUR_PAGES,
} from "@/test/bookFixture";
import type { ToonBookApi } from "./types";

async function readyBook(
  files = FOUR_PAGES,
  opts: Parameters<typeof initToonBook>[1] = {}
): Promise<{ api: ToonBookApi; els: ReturnType<typeof mountBookFixture> }> {
  stubManifestFetch(files);
  const els = mountBookFixture();
  const api = initToonBook(els, opts);
  expect(api).toBeDefined();
  await vi.waitFor(() => expect(api!.getPages().length).toBe(files.length));
  await vi.waitFor(() => {
    // First paint finished (cover + page 1 or single front cover)
    expect(
      els.slotRight.innerHTML.length + els.slotLeft.innerHTML.length
    ).toBeGreaterThan(0);
  });
  return { api: api!, els };
}

describe("FlipFrame reader (desktop / reduced-motion)", () => {
  beforeEach(() => {
    // Instant turns — no flip animation races
    stubReaderMatchMedia("reduce-motion");
    stubImagePreload();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("returns undefined when required els are missing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const api = initToonBook({
      book: null as unknown as HTMLElement,
      slotLeft: document.createElement("div"),
      slotRight: document.createElement("div"),
      indicator: document.createElement("span"),
      btnPrev: document.createElement("button"),
      btnNext: document.createElement("button"),
    });
    expect(api).toBeUndefined();
    spy.mockRestore();
  });

  it("starts on spread 0 with front-cover chrome and page 1 on the right", async () => {
    const { api, els } = await readyBook();
    expect(api.getViewIndex()).toBe(0);
    expect(els.slotLeft.querySelector(".front-cover-instructions")).toBeTruthy();
    expect(els.slotLeft.textContent).toMatch(/How to read|FlipFrame/i);
    const rightImg = els.slotRight.querySelector("img");
    expect(rightImg?.getAttribute("src")).toBe("assets/p1.jpg");
  });

  it("shows FlipFrame brand and optional sound control on the cover", async () => {
    const onSound = vi.fn();
    const { els } = await readyBook(FOUR_PAGES, {
      soundHint: "Turn sound on",
      getSoundEnabled: () => false,
      onSoundToggle: onSound,
    });
    expect(els.slotLeft.textContent).toMatch(/FlipFrame/);
    const soundBtn = els.slotLeft.querySelector(".front-cover-sound-btn");
    expect(soundBtn).toBeTruthy();
    (soundBtn as HTMLButtonElement).click();
    expect(onSound).toHaveBeenCalled();
  });

  it("advances spreads with goNext and goes back with goPrev", async () => {
    const { api, els } = await readyBook();

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    // Spread 1: left=p2, right=p3 (0-based: indices 1 and 2)
    expect(els.slotLeft.querySelector("img")?.getAttribute("src")).toBe("assets/p2.jpg");
    expect(els.slotRight.querySelector("img")?.getAttribute("src")).toBe("assets/p3.jpg");

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(2));
    expect(els.slotLeft.querySelector("img")?.getAttribute("src")).toBe("assets/p4.jpg");

    api.goPrev();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    expect(els.slotLeft.querySelector("img")?.getAttribute("src")).toBe("assets/p2.jpg");
  });

  it("does not go before the first spread or past the last", async () => {
    const { api } = await readyBook();
    expect(api.getViewIndex()).toBe(0);
    api.goPrev();
    expect(api.getViewIndex()).toBe(0);

    // totalSpreads = ceil((4+1)/2) = 3 → indices 0..2
    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(2));
    api.goNext();
    expect(api.getViewIndex()).toBe(2);
  });

  it("disables prev on first spread and next on last", async () => {
    const { api, els } = await readyBook();
    expect((els.btnPrev as HTMLButtonElement).disabled).toBe(true);
    expect((els.btnNext as HTMLButtonElement).disabled).toBe(false);

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    expect((els.btnPrev as HTMLButtonElement).disabled).toBe(false);

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(2));
    expect((els.btnNext as HTMLButtonElement).disabled).toBe(true);
  });

  it("navigates via next/prev buttons and nav zones", async () => {
    const { api, els } = await readyBook();

    (els.btnNext as HTMLButtonElement).click();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));

    els.zoneNext!.click();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(2));

    els.zonePrev!.click();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));

    (els.btnPrev as HTMLButtonElement).click();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(0));
  });

  it("navigates with keyboard arrow keys", async () => {
    const { api } = await readyBook();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(0));
  });

  it("updates the page indicator for spreads", async () => {
    const { api, els } = await readyBook();
    // Cover + page 1: only right has a page number
    expect(els.indicator.textContent).toMatch(/1\s*\/\s*4/);

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    expect(els.indicator.textContent).toMatch(/2\s*[–-]\s*3\s*\/\s*4/);
  });

  it("calls onPagePaint with 1-based page numbers", async () => {
    const painted: number[] = [];
    const { api } = await readyBook(FOUR_PAGES, {
      onPagePaint(_slot, n) {
        painted.push(n);
      },
    });
    await vi.waitFor(() => expect(painted).toContain(1));

    painted.length = 0;
    api.goNext();
    await vi.waitFor(() => {
      expect(painted).toEqual(expect.arrayContaining([2, 3]));
    });
  });

  it("calls beforeStart before the first paint", async () => {
    const order: string[] = [];
    stubManifestFetch(["a.jpg", "b.jpg"]);
    const els = mountBookFixture();
    initToonBook(els, {
      async beforeStart() {
        order.push("before");
      },
      onPagePaint() {
        order.push("paint");
      },
    });
    await vi.waitFor(() => {
      expect(order[0]).toBe("before");
      expect(order).toContain("paint");
    });
  });

  it("turn() is a no-op while already flipping (non-reduce path blocked)", async () => {
    // Use animated path: desktop without reduce-motion, but Image never completes
    // → isFlipping stays true during preload
    stubReaderMatchMedia("desktop");
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        complete = false;
        set src(_v: string) {
          /* never fire onload — hang preload */
        }
      }
    );
    stubManifestFetch(FOUR_PAGES);
    const els = mountBookFixture();
    const api = initToonBook(els, {});
    await vi.waitFor(() => expect(api!.getPages().length).toBe(4));

    api!.goNext(); // starts async turn, hangs in preload
    const idx = api!.getViewIndex();
    api!.goNext(); // should no-op while isFlipping
    expect(api!.getViewIndex()).toBe(idx);
    api!.destroy();
  });

  it("destroy is idempotent and stops keyboard nav", async () => {
    const { api } = await readyBook();
    api.destroy();
    api.destroy();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(api.getViewIndex()).toBe(0);
  });

  it("highlights top controls on start", async () => {
    const { els } = await readyBook();
    await vi.waitFor(() => {
      expect(els.topControls!.classList.contains("is-highlight-pulse")).toBe(true);
    });
  });
});

describe("FlipFrame reader (single-page / mobile)", () => {
  beforeEach(() => {
    stubReaderMatchMedia("mobile");
    // reduce motion off but we'll still get async flips — use reduce by combining
    // actually mobile without reduce still animates. Force reduce via custom stub:
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => {
        const mobile = query.includes("max-width");
        const reduce = query.includes("prefers-reduced-motion");
        return {
          matches: mobile || reduce, // mobile layout + instant turns
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
          onchange: null,
        };
      })
    );
    stubImagePreload();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("uses single-page body class and shows front cover first", async () => {
    const { api, els } = await readyBook(["a.jpg", "b.jpg"]);
    expect(document.body.classList.contains("single-page")).toBe(true);
    expect(api.getViewIndex()).toBe(0);
    expect(els.slotRight.querySelector(".front-cover-instructions")).toBeTruthy();
  });

  it("steps through cover → pages → end in single-page mode", async () => {
    const files = ["a.jpg", "b.jpg"];
    const { api, els } = await readyBook(files);

    // 0 front, 1 p1, 2 p2, 3 back → totalViews = 2+2 = 4
    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    expect(els.slotRight.querySelector("img")?.getAttribute("src")).toBe("a.jpg");
    expect(els.indicator.textContent).toMatch(/1\s*\/\s*2/);

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(2));
    expect(els.slotRight.querySelector("img")?.getAttribute("src")).toBe("b.jpg");

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(3));
    // back cover link
    expect(els.slotRight.querySelector(".back-cover-link")).toBeTruthy();
  });
});

describe("FlipFrame animated path (smoke)", () => {
  beforeEach(() => {
    stubReaderMatchMedia("desktop");
    stubImagePreload();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("creates a flip overlay then settles on the next spread", async () => {
    const { api, els } = await readyBook();
    api.goNext();

    // Overlay appears during animated turn
    await vi.waitFor(() => {
      const flip = els.book.querySelector(".flip-page");
      expect(flip).toBeTruthy();
    });

    // Force animation end
    const flip = els.book.querySelector(".flip-page") as HTMLElement;
    flip.dispatchEvent(new Event("animationend", { bubbles: true }));

    await vi.waitFor(() => {
      expect(api.getViewIndex()).toBe(1);
      expect(els.book.querySelector(".flip-page")).toBeNull();
    });
  });
});
