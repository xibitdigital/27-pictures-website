import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import ToonReaderShell from "./ToonReaderShell.vue";
import type { ToonShellBookOptions } from "./types";

const updateView = vi.fn();
const loadPages = vi.fn().mockResolvedValue(undefined);
const isVertical = ref(false);
const pages = ref<string[]>(["assets/1.jpg", "assets/2.jpg"]);

let lastBookOpts: Record<string, unknown> | undefined;

const engineState = {
  highlightPulse: false,
  ready: true,
  leftSlot: { kind: "blank" as const },
  rightSlot: { kind: "blank" as const },
  flip: null,
  indicator: "…",
  canPrev: false,
  canNext: true,
  isFlipping: false,
  pages: [] as string[],
  viewIndex: 0,
  singlePage: false,
  error: null as string | null,
  coverRev: 0,
};

vi.mock("./useToonBook", () => ({
  useToonBook: (opts: Record<string, unknown>) => {
    lastBookOpts = opts;
    return {
      engine: {
        state: engineState,
        subscribe: () => () => {},
        onFlipComplete: vi.fn(),
        goNext: vi.fn(),
        goPrev: vi.fn(),
        turn: vi.fn(),
        start: vi.fn(),
        destroy: vi.fn(),
        updateView,
        getViewIndex: () => 0,
        getPages: () => pages.value.slice(),
      },
      getApi: () => ({
        updateView,
        destroy: vi.fn(),
        goNext: vi.fn(),
        goPrev: vi.fn(),
        turn: vi.fn(),
        getViewIndex: () => 0,
        getPages: () => pages.value.slice(),
      }),
    };
  },
}));

vi.mock("./useViewMode", () => ({
  useViewMode: () => ({
    isVertical,
    pages,
    setVertical: vi.fn(),
    toggle: async () => {
      isVertical.value = !isVertical.value;
    },
    loadPages,
  }),
}));

vi.mock("./loadManifest", () => ({
  createManifestLoader: () => async () => pages.value.slice(),
  loadManifest: async () => pages.value.slice(),
  pagesFromManifest: (m: { files?: string[] }) => m.files ?? [],
}));

describe("ToonReaderShell", () => {
  beforeEach(() => {
    isVertical.value = false;
    pages.value = ["assets/1.jpg", "assets/2.jpg"];
    updateView.mockClear();
    loadPages.mockClear();
    lastBookOpts = undefined;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
  });

  function mountShell(bookOptions?: ToonShellBookOptions) {
    return mount(ToonReaderShell, {
      props: {
        altPrefix: "Test",
        frontCoverLogo: "/logo.png",
        coverTexture: "/tex.jpg",
        bookOptions,
      },
      attachTo: document.body,
      global: {
        stubs: {
          ReaderTopBar: {
            template: `<div class="top-bar-stub"><slot name="start" /><slot name="mid" /></div>`,
          },
          BookSurface: { template: `<div class="book-surface-stub"></div>` },
          VerticalStrip: {
            props: ["pages", "altPrefix", "onPagePaint"],
            emits: ["ready"],
            template: `<div class="strip-stub"></div>`,
          },
        },
      },
    });
  }

  it("shell ownership fields always win over bookOptions", async () => {
    const sneaky = {
      soundHint: "hi",
      getPages: async () => ["hijacked.jpg"],
      altPrefix: "Hijack",
      pages: ["nope.jpg"],
    } as unknown as ToonShellBookOptions;

    mountShell(sneaky);
    await flushPromises();

    expect(lastBookOpts?.altPrefix).toBe("Test");
    expect(lastBookOpts?.frontCoverLogo).toBe("/logo.png");
    expect(lastBookOpts?.coverTexture).toBe("/tex.jpg");
    expect(lastBookOpts?.getPages).toBeTypeOf("function");
    expect(lastBookOpts?.soundHint).toBe("hi");
    const resolved = await (lastBookOpts?.getPages as () => Promise<string[]>)();
    expect(resolved).toEqual(["assets/1.jpg", "assets/2.jpg"]);
  });

  it("exposes refreshCaptions + repaintCover as the parent API", async () => {
    const wrapper = mountShell();
    await flushPromises();

    const exposed = wrapper.vm as unknown as {
      refreshCaptions: () => void;
      repaintCover: () => void;
    };

    expect(typeof exposed.refreshCaptions).toBe("function");
    expect(typeof exposed.repaintCover).toBe("function");

    exposed.repaintCover();
    expect(updateView).toHaveBeenCalledWith(false);
  });

  it("loads pages once via shared path on mount", async () => {
    mountShell();
    await flushPromises();
    expect(loadPages).toHaveBeenCalled();
  });

  it("runs beforeStart then refresh path without parent slot reach-in", async () => {
    const beforeStart = vi.fn().mockResolvedValue(undefined);
    const onPagePaint = vi.fn();
    mountShell({ beforeStart, onPagePaint });
    await flushPromises();

    await (lastBookOpts?.beforeStart as () => Promise<void>)();
    expect(beforeStart).toHaveBeenCalled();
  });
});
