import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import ToonReaderShell from "./ToonReaderShell.vue";
import type { ToonShellBookOptions } from "./types";

const updateView = vi.fn();
const loadPages = vi.fn().mockResolvedValue(undefined);
const isVertical = ref(false);
const pages = ref<string[]>(["assets/1.jpg", "assets/2.jpg"]);
const prefersSinglePageMock = vi.fn(() => false);

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

vi.mock("./loadConfig", () => ({
  resolveConfigUrl: (url: string) => url,
  createConfigLoader: () => async () => pages.value.slice(),
  loadConfigPages: async () => pages.value.slice(),
  loadConfig: async () => ({ pages: pages.value.map((file) => ({ file, words: [] })) }),
  pagesFromConfig: (m: { pages?: { file: string }[] }) => (m.pages ?? []).map((p) => p.file),
  clearConfigCache: () => {},
}));

vi.mock("./bookModels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./bookModels")>();
  return {
    ...actual,
    prefersSinglePage: () => prefersSinglePageMock(),
  };
});

describe("ToonReaderShell", () => {
  beforeEach(() => {
    isVertical.value = false;
    pages.value = ["assets/1.jpg", "assets/2.jpg"];
    updateView.mockClear();
    loadPages.mockClear();
    lastBookOpts = undefined;
    prefersSinglePageMock.mockReturnValue(false);
    sessionStorage.clear();
    localStorage.removeItem("flipframe-scroll-howto");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
    sessionStorage.clear();
    localStorage.removeItem("flipframe-scroll-howto");
    vi.useRealTimers();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  function mountShell(bookOptions?: ToonShellBookOptions) {
    return mount(ToonReaderShell, {
      props: {
        altPrefix: "Test",
        configUrl: "/toons/test/config.json",
        assetPageDir: "/toons/test/",
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
          BookSurface: {
            props: ["coverTitle", "coverSubtitle", "coverSynopsis"],
            template: `<div class="book-surface-stub" :data-synopsis="coverSynopsis || ''"></div>`,
          },
          VerticalStrip: {
            props: ["pages", "altPrefix"],
            emits: ["ready"],
            template: `<div class="strip-stub"></div>`,
          },
          CoverGuideDialog: {
            props: ["open", "title", "subtitle", "synopsis"],
            emits: ["update:open"],
            template: `<div v-if="open" class="cover-guide-stub" data-testid="cover-guide">
              <span class="guide-title">{{ title }}</span>
              <button type="button" class="guide-close-stub" @click="$emit('update:open', false)">close</button>
            </div>`,
          },
        },
      },
    });
  }

  /** AutoReadPrompt is a HeadlessUI Dialog — it renders outside the wrapper root. */
  async function clickPrompt(which: "ok" | "later"): Promise<void> {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>(".sound-prompt__btn"));
    const btn = which === "ok" ? btns.find((b) => b.classList.contains("sound-prompt__btn--primary")) : btns.at(-1);
    if (!btn) throw new Error(`sound prompt "${which}" button not rendered`);
    btn.click();
    await flushPromises();
    await nextTick();
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

  it("runs beforeStart without parent slot reach-in", async () => {
    const beforeStart = vi.fn().mockResolvedValue(undefined);
    mountShell({ beforeStart });
    await flushPromises();

    await (lastBookOpts?.beforeStart as () => Promise<void>)();
    expect(beforeStart).toHaveBeenCalled();
  });

  it("forwards coverSynopsis to the book surface", async () => {
    const wrapper = mountShell({ coverSynopsis: "A rain-soaked city of wetwork." });
    await flushPromises();
    expect(wrapper.find(".book-surface-stub").attributes("data-synopsis")).toBe("A rain-soaked city of wetwork.");
  });

  it("shows Story toolbar button and auto-opens guide on mobile", async () => {
    prefersSinglePageMock.mockReturnValue(true);
    const wrapper = mountShell({
      coverTitle: "Nero",
      coverSynopsis: "Detective Nero hunts The Dog.",
    });
    await flushPromises();
    await nextTick();

    expect(wrapper.find(".cover-guide-toolbar-btn").exists()).toBe(true);
    expect(wrapper.find('[data-testid="cover-guide"]').exists()).toBe(true);
    expect(wrapper.find(".guide-title").text()).toBe("Nero");
  });

  it("hides Story toolbar button on desktop book view", async () => {
    prefersSinglePageMock.mockReturnValue(false);
    isVertical.value = false;
    const wrapper = mountShell();
    await flushPromises();
    await nextTick();

    expect(wrapper.find(".cover-guide-toolbar-btn").exists()).toBe(false);
    expect(wrapper.find('[data-testid="cover-guide"]').exists()).toBe(false);
  });

  it("shows Story button in vertical scroll mode and reopens after close", async () => {
    prefersSinglePageMock.mockReturnValue(false);
    isVertical.value = true;
    sessionStorage.setItem("flipframe-cover-guide:Test", "1");
    const wrapper = mountShell({ coverTitle: "Nero" });
    await flushPromises();
    await nextTick();

    // Seen this session — no auto-open
    expect(wrapper.find('[data-testid="cover-guide"]').exists()).toBe(false);
    expect(wrapper.find(".cover-guide-toolbar-btn").exists()).toBe(true);

    await wrapper.find(".cover-guide-toolbar-btn").trigger("click");
    await nextTick();
    expect(wrapper.find('[data-testid="cover-guide"]').exists()).toBe(true);

    await wrapper.find(".guide-close-stub").trigger("click");
    await nextTick();
    expect(wrapper.find('[data-testid="cover-guide"]').exists()).toBe(false);
    expect(sessionStorage.getItem("flipframe-cover-guide:Test")).toBe("1");
  });

  it("records session flag when guide is dismissed after auto-open", async () => {
    prefersSinglePageMock.mockReturnValue(true);
    const wrapper = mountShell({ coverTitle: "Nero" });
    await flushPromises();
    await nextTick();

    expect(wrapper.find('[data-testid="cover-guide"]').exists()).toBe(true);
    await wrapper.find(".guide-close-stub").trigger("click");
    await nextTick();
    expect(sessionStorage.getItem("flipframe-cover-guide:Test")).toBe("1");
  });

  it("shows the how-to once, as soon as the strip is readable on mobile", async () => {
    prefersSinglePageMock.mockReturnValue(true);
    isVertical.value = true;
    sessionStorage.setItem("flipframe-cover-guide:Test", "1");

    const wrapper = mountShell();
    await flushPromises();
    await nextTick();

    // The sound prompt owns the screen first — the toast waits its turn.
    expect(wrapper.find(".scroll-howto").exists()).toBe(false);
    await clickPrompt("later");

    expect(wrapper.find(".scroll-howto").exists()).toBe(true);
    expect(wrapper.find(".scroll-howto-body").text()).toMatch(/scroll|tap/i);
    expect(wrapper.find(".scroll-howto-arrow").exists()).toBe(true);
    expect(localStorage.getItem("flipframe-scroll-howto")).toBe("1");

    // Jitter under the threshold leaves it up; a real scroll clears it.
    Object.defineProperty(window, "scrollY", { value: 12, configurable: true });
    window.dispatchEvent(new Event("scroll"));
    await new Promise((r) => setTimeout(r, 60));
    await nextTick();
    expect(wrapper.find(".scroll-howto").exists()).toBe(true);

    Object.defineProperty(window, "scrollY", { value: 200, configurable: true });
    window.dispatchEvent(new Event("scroll"));
    await new Promise((r) => setTimeout(r, 60));
    await nextTick();
    expect(wrapper.find(".scroll-howto").exists()).toBe(false);

    wrapper.unmount();
    const again = mountShell();
    await flushPromises();
    await nextTick();
    expect(again.find(".scroll-howto").exists()).toBe(false);
    again.unmount();
  });

  it("freezes the strip behind an open dialog via body.dialog-open", async () => {
    prefersSinglePageMock.mockReturnValue(true);
    isVertical.value = true;

    const wrapper = mountShell();
    await flushPromises();
    await nextTick();

    // Cover guide up: the 16k-tall strip behind must not take the gesture.
    expect(document.body.classList.contains("dialog-open")).toBe(true);

    await wrapper.find(".guide-close-stub").trigger("click");
    await flushPromises();
    await nextTick();
    // Sound prompt is the next dialog — still locked.
    expect(document.body.classList.contains("dialog-open")).toBe(true);

    await clickPrompt("ok");
    expect(document.body.classList.contains("dialog-open")).toBe(false);

    wrapper.unmount();
    expect(document.body.classList.contains("dialog-open")).toBe(false);
  });

  it("does not show the how-to while the cover guide is open", async () => {
    prefersSinglePageMock.mockReturnValue(true);
    isVertical.value = true;

    const wrapper = mountShell();
    await flushPromises();
    await nextTick();
    expect(wrapper.find('[data-testid="cover-guide"]').exists()).toBe(true);
    expect(wrapper.find(".scroll-howto").exists()).toBe(false);

    // Closing the guide raises the sound prompt, which owns the screen next.
    await wrapper.find(".guide-close-stub").trigger("click");
    await flushPromises();
    await nextTick();
    expect(document.querySelector(".sound-prompt__panel")).not.toBeNull();
    expect(wrapper.find(".scroll-howto").exists()).toBe(false);

    // Only once nothing else is in the way does the toast land.
    await clickPrompt("ok");
    expect(wrapper.find(".scroll-howto").exists()).toBe(true);
  });
});
