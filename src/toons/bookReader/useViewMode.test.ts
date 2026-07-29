import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useViewMode, prefersMobileScroll, MOBILE_MAX_WIDTH } from "./useViewMode";

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
    vi.unstubAllGlobals();
    document.body.className = "";
  });

  it("loads pages from manifest files list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          files: ["assets/a.jpg", "assets/b.jpg", "assets/c.jpg"],
        }),
      })
    );

    const vm = withSetup(() => useViewMode({ mobileDefault: false }));
    await vm.loadPages("manifest.json");
    expect(vm.pages.value).toEqual(["assets/a.jpg", "assets/b.jpg", "assets/c.jpg"]);
  });

  it("builds pages from pattern when files missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          pages: 3,
          pattern: "assets/{n}.jpg",
        }),
      })
    );

    const vm = withSetup(() => useViewMode({ mobileDefault: false }));
    await vm.loadPages();
    expect(vm.pages.value).toEqual(["assets/1.jpg", "assets/2.jpg", "assets/3.jpg"]);
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
        json: async () => ({ files: ["a.jpg"] }),
      })
    );

    const vm = withSetup(() =>
      useViewMode({
        mobileDefault: false,
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
        json: async () => ({ files: ["a.jpg"] }),
      })
    );
    const vm = withSetup(() => useViewMode({ mobileDefault: false }));
    expect(vm.isVertical.value).toBe(false);
    await vm.toggle();
    expect(vm.isVertical.value).toBe(true);
    await vm.toggle();
    expect(vm.isVertical.value).toBe(false);
  });
});
