/**
 * Legacy path — full coverage lives in bookReader/LangSwitcher.test.ts.
 * Keep a thin smoke test so the re-export still mounts.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import LangSwitcher from "./LangSwitcher.vue";
import type { WordOverlay } from "../../bookReader/words";

describe("jax/components/LangSwitcher (re-export)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders shared switcher when overlay is set", () => {
    const overlay = {
      getLang: vi.fn(() => "en"),
      setLang: vi.fn(),
      getLanguages: vi.fn(() => [{ code: "en", label: "EN" }]),
    } as unknown as WordOverlay;

    const wrapper = mount(LangSwitcher, {
      props: { overlay },
      attachTo: document.body,
    });
    expect(wrapper.find(".toon-lang-switcher").exists()).toBe(true);
    expect(wrapper.find(".toon-lang-toggle-label").text()).toBe("EN");
  });
});
