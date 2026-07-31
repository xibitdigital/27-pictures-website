import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";

const { updateView, loadPages, toggle, isVertical, pages, mockEngine } = vi.hoisted(() => {
  const { ref } = require("vue") as typeof import("vue");
  const updateView = vi.fn();
  const loadPages = vi.fn().mockResolvedValue(undefined);
  const toggle = vi.fn();
  const isVertical = ref(false);
  const pages = ref<string[]>(["assets/1.jpg", "assets/2.jpg"]);
  const mockEngine = {
    state: {
      highlightPulse: false,
      ready: true,
      leftSlot: { kind: "blank" as const },
      rightSlot: { kind: "blank" as const },
      flip: null as null,
      indicator: "…",
      canPrev: false,
      canNext: true,
      isFlipping: false,
      pages: [] as string[],
      viewIndex: 0,
      singlePage: false,
      error: null as string | null,
      coverRev: 0,
    },
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
  };
  return { updateView, loadPages, toggle, isVertical, pages, mockEngine };
});

vi.mock("../bookReader/useToonBook", () => ({
  useToonBook: () => ({
    engine: mockEngine,
    getApi: () => mockEngine,
  }),
}));

vi.mock("../bookReader/useViewMode", () => ({
  useViewMode: () => ({
    isVertical,
    pages,
    setVertical: vi.fn(async (on: boolean) => {
      isVertical.value = on;
      document.body.classList.toggle("view-vertical", on);
    }),
    toggle: async () => {
      isVertical.value = !isVertical.value;
      document.body.classList.toggle("view-vertical", isVertical.value);
      toggle();
    },
    loadPages,
  }),
}));

vi.mock("../bookReader/loadConfig", () => ({
  resolveConfigUrl: (url: string) => url,
  createConfigLoader: () => async () => pages.value.slice(),
  loadConfigPages: async () => pages.value.slice(),
  loadConfig: async () => ({ pages: pages.value.map((file) => ({ file, words: [] })) }),
  pagesFromConfig: (m: { pages?: { file: string }[] }) => (m.pages ?? []).map((p) => p.file),
  clearConfigCache: () => {},
}));

vi.mock("../bookReader/words", () => {
  class WordOverlay {
    render = vi.fn();
    refreshSlots = vi.fn();
    getLanguages = () => [
      { code: "en", label: "EN" },
      { code: "it", label: "IT" },
    ];
    getLang = () => "en";
    setLang = vi.fn();
  }
  return {
    WordOverlay,
    loadWords: vi.fn().mockResolvedValue({
      designWidth: 1008,
      designHeight: 1792,
      pages: [],
      languages: [{ code: "en", label: "EN" }],
      defaultLang: "en",
    }),
  };
});

// Import after mocks
import JaxApp from "./JaxApp.vue";

function mountJax() {
  return mount(JaxApp, {
    attachTo: document.body,
    global: {
      stubs: {
        FullscreenButton: { template: `<button type="button" class="fs-stub">FS</button>` },
        VerticalStrip: {
          props: ["pages", "altPrefix", "onPagePaint"],
          emits: ["ready"],
          template: `<div class="strip-stub"></div>`,
        },
        TransitionRoot: {
          props: ["show"],
          template: `<div v-if="show"><slot /></div>`,
        },
        TransitionChild: { template: `<div><slot /></div>` },
        Dialog: { template: `<div class="dialog-stub"><slot /></div>` },
        DialogPanel: { template: `<div><slot /></div>` },
        DialogTitle: { template: `<h2><slot /></h2>` },
        Listbox: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template: `<div class="listbox"><slot :open="false" /></div>`,
        },
        ListboxButton: {
          template: `<button type="button" class="jax-lang-toggle"><slot /></button>`,
        },
        ListboxOptions: { template: `<div><slot /></div>` },
        ListboxOption: {
          template: `<button type="button"><slot :active="false" :selected="false" /></button>`,
        },
      },
    },
  });
}

describe("JaxApp", () => {
  beforeEach(() => {
    isVertical.value = false;
    pages.value = ["assets/1.jpg", "assets/2.jpg"];
    updateView.mockClear();
    loadPages.mockClear();
    toggle.mockClear();

    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, "paused", { configurable: true, get: () => false });
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    });
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, "paused", { configurable: true, get: () => true });
      this.dispatchEvent(new Event("pause"));
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
    vi.restoreAllMocks();
  });

  it("mounts chrome: lang, scroll, music, back link (no SFX mute gate)", async () => {
    const wrapper = mountJax();
    await flushPromises();

    expect(wrapper.find(".toons-back").attributes("href")).toBe("/experiments/");
    expect(wrapper.find('button[title="Enable sound effects"]').exists()).toBe(false);
    expect(wrapper.find('button[title="Switch to vertical scroll view"]').exists()).toBe(true);
    expect(wrapper.find('button[title="Play music"]').exists()).toBe(true);
    expect(loadPages).toHaveBeenCalled();
  });

  it("toggles background music on and off", async () => {
    const wrapper = mountJax();
    await flushPromises();

    const audio = wrapper.find("#bgMusic").element as HTMLAudioElement;
    expect(audio.volume).toBeCloseTo(0.22);

    await wrapper.find('button[title="Play music"]').trigger("click");
    await flushPromises();
    await nextTick();

    expect(wrapper.find('button[title="Pause music"]').exists()).toBe(true);
    expect(wrapper.find('button[title="Pause music"]').classes()).toContain("is-active");

    await wrapper.find('button[title="Pause music"]').trigger("click");
    await flushPromises();
    await nextTick();

    expect(wrapper.find('button[title="Play music"]').exists()).toBe(true);
    expect(audio.muted).toBe(true);
  });

  it("toggles scroll mode via view button", async () => {
    const wrapper = mountJax();
    await flushPromises();

    const btn = wrapper.find('button[title="Switch to vertical scroll view"]');
    await btn.trigger("click");
    await nextTick();

    expect(isVertical.value).toBe(true);
    expect(document.body.classList.contains("view-vertical")).toBe(true);
    expect(wrapper.find('button[title="Switch to book view"]').exists()).toBe(true);
  });
});
