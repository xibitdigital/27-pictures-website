import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";

describe("vReveal", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("adds reveal + active immediately when IntersectionObserver is missing", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { vReveal } = await import("./reveal");

    const Comp = defineComponent({
      template: `<div class="block" v-reveal>Hi</div>`,
    });
    const wrapper = mount(Comp, {
      global: { directives: { reveal: vReveal } },
      attachTo: document.body,
    });

    const el = wrapper.find(".block").element as HTMLElement;
    expect(el.classList.contains("reveal")).toBe(true);
    expect(el.classList.contains("active")).toBe(true);
  });

  it("observes the element when IntersectionObserver exists", async () => {
    const observe = vi.fn();
    const unobserve = vi.fn();
    class FakeIO {
      constructor(_cb: IntersectionObserverCallback) {}
      observe = observe;
      unobserve = unobserve;
      disconnect = vi.fn();
      takeRecords = () => [] as IntersectionObserverEntry[];
      root = null;
      rootMargin = "";
      thresholds: number[] = [];
    }
    vi.stubGlobal("IntersectionObserver", FakeIO);

    // Fresh module so observer is built with our stub
    vi.resetModules();
    const { vReveal } = await import("./reveal");

    const Comp = defineComponent({
      template: `<section class="sec" v-reveal />`,
    });
    const wrapper = mount(Comp, {
      global: { directives: { reveal: vReveal } },
      attachTo: document.body,
    });

    const el = wrapper.find(".sec").element as HTMLElement;
    expect(el.classList.contains("reveal")).toBe(true);
    expect(observe).toHaveBeenCalledWith(el);

    wrapper.unmount();
    expect(unobserve).toHaveBeenCalledWith(el);
  });

  it("adds active when the observer reports intersection", async () => {
    let callback:
      | ((entries: IntersectionObserverEntry[], obs: IntersectionObserver) => void)
      | null = null;
    class FakeIO {
      constructor(
        cb: (entries: IntersectionObserverEntry[], obs: IntersectionObserver) => void
      ) {
        callback = cb;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = () => [] as IntersectionObserverEntry[];
      root = null;
      rootMargin = "";
      thresholds: number[] = [];
    }
    vi.stubGlobal("IntersectionObserver", FakeIO);

    vi.resetModules();
    const { vReveal } = await import("./reveal");

    const Comp = defineComponent({
      template: `<div class="r" v-reveal />`,
    });
    const wrapper = mount(Comp, {
      global: { directives: { reveal: vReveal } },
      attachTo: document.body,
    });
    const el = wrapper.find(".r").element as HTMLElement;
    expect(el.classList.contains("active")).toBe(false);

    expect(callback).toBeTypeOf("function");
    callback!(
      [
        {
          isIntersecting: true,
          target: el,
          intersectionRatio: 1,
          boundingClientRect: el.getBoundingClientRect(),
          intersectionRect: el.getBoundingClientRect(),
          rootBounds: null,
          time: 0,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver
    );

    expect(el.classList.contains("active")).toBe(true);
  });
});
