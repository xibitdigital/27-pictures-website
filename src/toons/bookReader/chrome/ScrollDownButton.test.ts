import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import ScrollDownButton from "./ScrollDownButton.vue";

describe("ScrollDownButton", () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    scrollTo.mockReset();
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is a labelled page-down control", () => {
    const w = mount(ScrollDownButton);
    const btn = w.get("[data-scroll-down]");
    expect(btn.attributes("aria-label")).toMatch(/scroll down/i);
    expect(btn.attributes("type")).toBe("button");
  });

  it("scrolls 90% of the viewport on press when the next plate is further away", async () => {
    const w = mount(ScrollDownButton);
    await w.get("[data-scroll-down]").trigger("click");
    expect(scrollTo).toHaveBeenCalledWith({ top: 720, behavior: "smooth" });
  });

  it("does the normal 90% jump when the next plate's align is behind it", async () => {
    const next = document.createElement("div");
    next.getBoundingClientRect = () =>
      ({
        top: 400,
        bottom: 1400,
        height: 1000,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: 400,
        toJSON: () => {},
      }) as DOMRect;
    const w = mount(ScrollDownButton, { props: { pages: [next] } });
    await w.get("[data-scroll-down]").trigger("click");
    // Default chrome 4 + 4px gap → align at 400 - 8 = 392, behind the 720 jump — never snap backward.
    expect(scrollTo).toHaveBeenCalledWith({ top: 720, behavior: "smooth" });
  });
});
