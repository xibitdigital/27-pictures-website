import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import LangSwitcher from "./LangSwitcher.vue";
import type { WordOverlay } from "../../bookReader/words";

function mockOverlay(lang = "en"): WordOverlay {
  return {
    getLang: vi.fn(() => lang),
    setLang: vi.fn(),
    getLanguages: vi.fn(() => [
      { code: "en", label: "EN" },
      { code: "it", label: "IT" },
      { code: "de", label: "DE" },
    ]),
  } as unknown as WordOverlay;
}

describe("LangSwitcher", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders nothing when overlay is null", () => {
    const wrapper = mount(LangSwitcher, {
      props: { overlay: null },
      attachTo: document.body,
    });
    expect(wrapper.find(".jax-lang-switcher").exists()).toBe(false);
  });

  it("shows current language label from overlay", () => {
    const overlay = mockOverlay("it");
    const wrapper = mount(LangSwitcher, {
      props: { overlay },
      attachTo: document.body,
    });
    expect(wrapper.find(".jax-lang-toggle-label").text()).toBe("IT");
    expect(overlay.getLang).toHaveBeenCalled();
  });

  it("calls setLang and emits change when a language is chosen", async () => {
    const overlay = mockOverlay("en");
    const wrapper = mount(LangSwitcher, {
      props: { overlay },
      attachTo: document.body,
    });

    // Open listbox
    await wrapper.find(".jax-lang-toggle").trigger("click");
    await flushPromises();

    const options = wrapper.findAll(".jax-lang-option");
    expect(options.length).toBeGreaterThanOrEqual(2);
    const itBtn = options.find((b) => b.text() === "IT");
    expect(itBtn).toBeTruthy();
    await itBtn!.trigger("click");
    await flushPromises();

    expect(overlay.setLang).toHaveBeenCalledWith("it");
    expect(wrapper.emitted("change")).toBeTruthy();
    expect(wrapper.find(".jax-lang-toggle-label").text()).toBe("IT");
  });
});
