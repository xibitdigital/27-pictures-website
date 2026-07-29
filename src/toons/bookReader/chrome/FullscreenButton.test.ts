import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import FullscreenButton from "./FullscreenButton.vue";

describe("FullscreenButton", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  afterEach(() => {
    document.body.className = "";
    vi.restoreAllMocks();
  });

  it("renders Full label when not fullscreen", () => {
    const wrapper = mount(FullscreenButton);
    expect(wrapper.find(".toon-fs-label").text()).toBe("Full");
    expect(wrapper.find("button").attributes("aria-pressed")).toBe("false");
  });

  it("requests fullscreen on click when supported", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });

    const wrapper = mount(FullscreenButton);
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(requestFullscreen).toHaveBeenCalled();
  });

  it("toggles is-fullscreen body class on fullscreenchange", async () => {
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => document.documentElement,
    });

    mount(FullscreenButton, { attachTo: document.body });
    document.dispatchEvent(new Event("fullscreenchange"));
    await flushPromises();
    expect(document.body.classList.contains("is-fullscreen")).toBe(true);
  });
});
