import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import ScrollDownButton from "./ScrollDownButton.vue";

describe("ScrollDownButton", () => {
  const scrollBy = vi.fn();

  beforeEach(() => {
    scrollBy.mockReset();
    Object.defineProperty(window, "scrollBy", { configurable: true, value: scrollBy });
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

  it("scrolls 80% of the viewport on press", async () => {
    const w = mount(ScrollDownButton);
    await w.get("[data-scroll-down]").trigger("click");
    expect(scrollBy).toHaveBeenCalledWith({ top: 640, behavior: "smooth" });
  });
});
