import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { defineComponent, h, nextTick, onBeforeUnmount, onMounted } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createBookEngine, initToonBook } from "./bookReader";
import BookSurface from "./BookSurface.vue";
import { stubReaderMatchMedia, stubImagePreload, stubManifestFetch, FOUR_PAGES } from "@/test/bookFixture";
import type { ToonBookApi, ToonBookOptions } from "./types";

async function readyBook(
  files = FOUR_PAGES,
  opts: ToonBookOptions = {}
): Promise<{ api: ToonBookApi; wrapper: ReturnType<typeof mount> }> {
  stubManifestFetch(files);
  const engine = createBookEngine({ ...opts, pages: files });

  const Host = defineComponent({
    setup() {
      onMounted(() => {
        void engine.start();
      });
      onBeforeUnmount(() => engine.destroy());
      return () =>
        h(BookSurface, {
          engine,
          altPrefix: opts.altPrefix || "Page",
          coverTitle: opts.coverTitle || opts.altPrefix || "Page",
          coverSubtitle: opts.coverSubtitle ?? "Experiment",
          frontCoverLogo: opts.frontCoverLogo,
          coverTexture: opts.coverTexture,
          soundHint: opts.soundHint,
          soundEnabled: opts.getSoundEnabled?.() ?? false,
          backHref: opts.backHref,
          backLabel: opts.backLabel,
          onPagePaint: opts.onPagePaint,
          onPageClear: opts.onPageClear,
          onSoundToggle: opts.onSoundToggle,
        });
    },
  });

  const wrapper = mount(Host, { attachTo: document.body });
  await flushPromises();
  await vi.waitFor(() => expect(engine.state.ready).toBe(true));
  await nextTick();
  return { api: engine, wrapper };
}

describe("FlipFrame reader (desktop / reduced-motion)", () => {
  beforeEach(() => {
    stubReaderMatchMedia("reduce-motion");
    stubImagePreload();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("initToonBook returns an API without requiring DOM els", () => {
    const api = initToonBook(null, { pages: ["a.jpg"] });
    expect(api).toBeDefined();
    api?.destroy();
  });

  it("starts on spread 0 with front-cover chrome and page 1 on the right", async () => {
    const { api, wrapper } = await readyBook();
    expect(api.getViewIndex()).toBe(0);
    expect(wrapper.find(".front-cover-instructions").exists()).toBe(true);
    expect(wrapper.text()).toMatch(/How to read|FlipFrame/i);
    const rightImg = wrapper.find(".page-slot.right img:not(.cover-texture-img)");
    expect(rightImg.attributes("src")).toBe("assets/p1.jpg");
  });

  it("shows FlipFrame brand and optional sound control on the cover", async () => {
    const onSound = vi.fn();
    const { wrapper } = await readyBook(FOUR_PAGES, {
      soundHint: "Turn sound on",
      getSoundEnabled: () => false,
      onSoundToggle: onSound,
    });
    expect(wrapper.text()).toMatch(/FlipFrame/);
    const soundBtn = wrapper.find(".front-cover-sound-btn");
    expect(soundBtn.exists()).toBe(true);
    await soundBtn.trigger("click");
    expect(onSound).toHaveBeenCalled();
  });

  it("advances spreads with goNext and goes back with goPrev", async () => {
    const { api, wrapper } = await readyBook();

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    expect(wrapper.find(".page-slot.left img:not(.cover-texture-img)").attributes("src")).toBe("assets/p2.jpg");
    expect(wrapper.find(".page-slot.right img:not(.cover-texture-img)").attributes("src")).toBe("assets/p3.jpg");

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(2));
    expect(wrapper.find(".page-slot.left img:not(.cover-texture-img)").attributes("src")).toBe("assets/p4.jpg");

    api.goPrev();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    expect(wrapper.find(".page-slot.left img:not(.cover-texture-img)").attributes("src")).toBe("assets/p2.jpg");
  });

  it("fires onPageTurn for successful next/prev (not at bounds)", async () => {
    const onPageTurn = vi.fn();
    const { api } = await readyBook(FOUR_PAGES, { onPageTurn });

    api.goPrev();
    expect(onPageTurn).not.toHaveBeenCalled();

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    expect(onPageTurn).toHaveBeenCalledWith(1);

    api.goPrev();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(0));
    expect(onPageTurn).toHaveBeenCalledWith(-1);
    expect(onPageTurn).toHaveBeenCalledTimes(2);
  });

  it("does not go before the first spread or past the last", async () => {
    const { api } = await readyBook();
    expect(api.getViewIndex()).toBe(0);
    api.goPrev();
    expect(api.getViewIndex()).toBe(0);

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(2));
    api.goNext();
    expect(api.getViewIndex()).toBe(2);
  });

  it("disables prev on first spread and next on last", async () => {
    const { api, wrapper } = await readyBook();
    expect((wrapper.find("#btn-prev").element as HTMLButtonElement).disabled).toBe(true);
    expect((wrapper.find("#btn-next").element as HTMLButtonElement).disabled).toBe(false);

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    expect((wrapper.find("#btn-prev").element as HTMLButtonElement).disabled).toBe(false);

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(2));
    expect((wrapper.find("#btn-next").element as HTMLButtonElement).disabled).toBe(true);
  });

  it("navigates via next/prev buttons and nav zones", async () => {
    const { api, wrapper } = await readyBook();

    await wrapper.find("#btn-next").trigger("click");
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));

    await wrapper.find("#zone-next").trigger("click");
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(2));

    await wrapper.find("#zone-prev").trigger("click");
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));

    await wrapper.find("#btn-prev").trigger("click");
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
    const { api, wrapper } = await readyBook();
    expect(wrapper.find("#indicator").text()).toMatch(/1\s*\/\s*4/);

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    expect(wrapper.find("#indicator").text()).toMatch(/2\s*[–-]\s*3\s*\/\s*4/);
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
    const { wrapper } = await readyBook(["a.jpg", "b.jpg"], {
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
    expect(wrapper.find(".page-slot").exists()).toBe(true);
  });

  it("turn() is a no-op while already flipping (non-reduce path blocked)", async () => {
    stubReaderMatchMedia("desktop");
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        complete = false;
        set src(_v: string) {
          /* hang preload */
        }
      }
    );
    const engine = createBookEngine({ pages: FOUR_PAGES });
    await engine.start();

    engine.goNext();
    const idx = engine.getViewIndex();
    engine.goNext();
    expect(engine.getViewIndex()).toBe(idx);
    engine.destroy();
  });

  it("destroy is idempotent and stops keyboard nav", async () => {
    const { api } = await readyBook();
    api.destroy();
    api.destroy();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(api.getViewIndex()).toBe(0);
  });

  it("highlights top controls on start", async () => {
    const engine = createBookEngine({ pages: FOUR_PAGES });
    const pulses: boolean[] = [];
    engine.subscribe(() => pulses.push(engine.state.highlightPulse));
    await engine.start();
    await vi.waitFor(() => expect(pulses).toContain(true));
    engine.destroy();
  });
});

describe("FlipFrame reader (single-page / mobile)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => {
        const mobile = query.includes("max-width");
        const reduce = query.includes("prefers-reduced-motion");
        return {
          matches: mobile || reduce,
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
    const { api, wrapper } = await readyBook(["a.jpg", "b.jpg"]);
    expect(document.body.classList.contains("single-page")).toBe(true);
    expect(api.getViewIndex()).toBe(0);
    expect(wrapper.find(".front-cover-instructions").exists()).toBe(true);
  });

  it("steps through cover → pages → end in single-page mode", async () => {
    const files = ["a.jpg", "b.jpg"];
    const { api, wrapper } = await readyBook(files);

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(1));
    expect(wrapper.find(".page-slot.right img:not(.cover-texture-img)").attributes("src")).toBe("a.jpg");
    expect(wrapper.find("#indicator").text()).toMatch(/1\s*\/\s*2/);

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(2));
    expect(wrapper.find(".page-slot.right img:not(.cover-texture-img)").attributes("src")).toBe("b.jpg");

    api.goNext();
    await vi.waitFor(() => expect(api.getViewIndex()).toBe(3));
    expect(wrapper.find(".back-cover-link").exists()).toBe(true);
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

  it("can start a flip without throwing", async () => {
    const { api } = await readyBook(FOUR_PAGES);
    api.goNext();
    // either animating or already settled under slow timers
    await vi.waitFor(() => expect(api.getViewIndex()).toBeGreaterThanOrEqual(0));
    api.destroy();
  });
});
