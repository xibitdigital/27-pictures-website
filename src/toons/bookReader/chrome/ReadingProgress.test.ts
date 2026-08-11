import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ReadingProgress from "./ReadingProgress.vue";

describe("ReadingProgress", () => {
  it("scales the fill to the reading position", () => {
    const w = mount(ReadingProgress, { props: { value: 0.25 } });
    expect(w.find(".toon-progress-fill").attributes("style")).toContain("scaleX(0.25)");
    expect(w.attributes("aria-valuenow")).toBe("25");
  });

  it("clamps out-of-range values", () => {
    const over = mount(ReadingProgress, { props: { value: 4 } });
    expect(over.find(".toon-progress-fill").attributes("style")).toContain("scaleX(1)");
    expect(over.attributes("aria-valuenow")).toBe("100");

    const under = mount(ReadingProgress, { props: { value: -1 } });
    expect(under.find(".toon-progress-fill").attributes("style")).toContain("scaleX(0)");
    expect(under.attributes("aria-valuenow")).toBe("0");
  });

  it("keeps the page count available to screen readers", () => {
    const w = mount(ReadingProgress, { props: { value: 0.5, label: "3 / 20" } });
    expect(w.attributes("role")).toBe("progressbar");
    expect(w.attributes("aria-valuetext")).toBe("3 / 20");
  });

  it("omits aria-valuetext when there is no label", () => {
    const w = mount(ReadingProgress, { props: { value: 0.5 } });
    expect(w.attributes("aria-valuetext")).toBeUndefined();
  });
});
