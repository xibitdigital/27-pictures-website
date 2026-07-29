import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ViewModeToggle from "./ViewModeToggle.vue";

describe("ViewModeToggle", () => {
  it("shows Scroll label when in book mode", () => {
    const wrapper = mount(ViewModeToggle, { props: { isVertical: false } });
    expect(wrapper.find(".toon-fs-label").text()).toBe("Scroll");
    expect(wrapper.find("button").attributes("title")).toMatch(/vertical scroll/i);
    expect(wrapper.find("button").classes()).not.toContain("is-active");
  });

  it("shows Book label when in vertical mode", () => {
    const wrapper = mount(ViewModeToggle, { props: { isVertical: true } });
    expect(wrapper.find(".toon-fs-label").text()).toBe("Book");
    expect(wrapper.find("button").attributes("title")).toMatch(/book view/i);
    expect(wrapper.find("button").classes()).toContain("is-active");
    expect(wrapper.find("button").attributes("aria-pressed")).toBe("true");
  });

  it("emits toggle on click", async () => {
    const wrapper = mount(ViewModeToggle, { props: { isVertical: false } });
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("toggle")).toHaveLength(1);
  });
});
