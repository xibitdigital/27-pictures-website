import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useViewMode, prefersMobileScroll, MOBILE_MAX_WIDTH } from "./useViewMode";
import { clearConfigCache } from "./loadConfig";

/** Run a composable inside a real component setup() so onMounted is valid. */
function withSetup<T>(factory: () => T): T {
  let result!: T;
  const Comp = defineComponent({
    setup() {
      result = factory();
      return () => null;
    },
  });
  mount(Comp);
  return result;
}

describe("prefersMobileScroll / MOBILE_MAX_WIDTH", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports the same breakpoint as the book single-page mode", () => {
    expect(MOBILE_MAX_WIDTH).toBe(768);
  });

  it("reads matchMedia", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((q: string) => ({
        matches: q.includes("768"),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }))
    );
    expect(prefersMobileScroll()).toBe(true);
  });
});

describe("useViewMode", () => {
  beforeEach(() => {
    document.body.className = "";
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }))
    );
  });

  afterEach(() => {
    clearConfigCache();
    vi.unstubAllGlobals();
    document.body.className = "";
  });

  it("loads pages from config page file list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          pages: [
            { file: "assets/a.jpg", words: [] },
            { file: "assets/b.jpg", words: [] },
            { file: "assets/c.jpg", words: [] },
          ],
        }),
      })
    );

    const vm = withSetup(() => useViewMode({ mobileDefault: false, configUrl: "config.json" }));
    await vm.loadPages("config.json");
    expect(vm.pages.value).toEqual(["assets/a.jpg", "assets/b.jpg", "assets/c.jpg"]);
  });

  it("starts vertical at desktop widths when defaultVertical is set", async () => {
    // matchMedia is stubbed to matches:false in this describe — i.e. desktop.
    const vm = withSetup(() => useViewMode({ defaultVertical: true, configUrl: "config.json" }));
    await nextTick();
    expect(vm.isVertical.value).toBe(true);
    expect(document.body.classList.contains("view-vertical")).toBe(true);
  });

  it("stays in book mode at desktop widths without defaultVertical", async () => {
    const vm = withSetup(() => useViewMode({ configUrl: "config.json" }));
    await nextTick();
    expect(vm.isVertical.value).toBe(false);
  });

  it("loads empty list when config has no pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ pages: [] }),
      })
    );

    const vm = withSetup(() => useViewMode({ mobileDefault: false, configUrl: "config.json" }));
    await vm.loadPages();
    expect(vm.pages.value).toEqual([]);
  });

  it("toggles body.view-vertical and fires callbacks", async () => {
    const onEnterScroll = vi.fn();
    const onEnterBook = vi.fn();
    const reader = ref<HTMLElement | null>(document.createElement("div"));
    reader.value!.scrollTop = 40;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ pages: [{ file: "a.jpg", words: [] }] }),
      })
    );

    const vm = withSetup(() =>
      useViewMode({
        mobileDefault: false,
        configUrl: "config.json",
        reader,
        onEnterScroll,
        onEnterBook,
      })
    );

    await vm.setVertical(true);
    await nextTick();
    expect(vm.isVertical.value).toBe(true);
    expect(document.body.classList.contains("view-vertical")).toBe(true);
    expect(onEnterScroll).toHaveBeenCalled();
    expect(reader.value!.scrollTop).toBe(0);

    await vm.setVertical(false);
    expect(vm.isVertical.value).toBe(false);
    expect(document.body.classList.contains("view-vertical")).toBe(false);
    expect(onEnterBook).toHaveBeenCalled();
  });

  it("toggle flips vertical state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ pages: [{ file: "a.jpg", words: [] }] }),
      })
    );
    const vm = withSetup(() => useViewMode({ mobileDefault: false, configUrl: "config.json" }));
    expect(vm.isVertical.value).toBe(false);
    await vm.toggle();
    expect(vm.isVertical.value).toBe(true);
    await vm.toggle();
    expect(vm.isVertical.value).toBe(false);
  });
});
