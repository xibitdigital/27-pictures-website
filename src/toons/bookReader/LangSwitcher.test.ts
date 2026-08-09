import { describe, it, expect, vi, afterEach } from "vitest";
import { computed, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import LangSwitcher from "./LangSwitcher.vue";
import { TOON_CAPTIONS_KEY, type ToonCaptionsStore } from "./captions/useToonCaptions";

function mockCaptions(lang = "en"): ToonCaptionsStore {
  const current = ref(lang);
  return {
    ready: ref(true),
    lang: current,
    languages: computed(() => [
      { code: "en", label: "EN" },
      { code: "it", label: "IT" },
      { code: "de", label: "DE" },
      { code: "fr", label: "FR" },
    ]),
    designWidth: computed(() => 1008),
    designHeight: computed(() => 1792),
    fontFamily: computed(() => '"Bangers", cursive'),
    wordsForPage: () => [],
    setLang: vi.fn((code: string) => {
      current.value = code;
    }),
    load: vi.fn(async () => {}),
  };
}

function mountSwitcher(store: ToonCaptionsStore | null) {
  return mount(LangSwitcher, {
    attachTo: document.body,
    global: { provide: store ? { [TOON_CAPTIONS_KEY as symbol]: store } : {} },
  });
}

describe("LangSwitcher", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders nothing without a captions store (toons with no captions)", () => {
    const wrapper = mountSwitcher(null);
    expect(wrapper.find(".toon-lang-switcher").exists()).toBe(false);
  });

  it("shows the current caption language", () => {
    const wrapper = mountSwitcher(mockCaptions("it"));
    expect(wrapper.find(".toon-lang-toggle-label").text()).toBe("IT");
  });

  it("sets the language and emits change when one is chosen", async () => {
    const store = mockCaptions("en");
    const wrapper = mountSwitcher(store);

    await wrapper.find(".toon-lang-toggle").trigger("click");
    await flushPromises();

    const options = wrapper.findAll(".toon-lang-option");
    expect(options.length).toBeGreaterThanOrEqual(2);
    const itBtn = options.find((b) => b.text() === "IT");
    expect(itBtn).toBeTruthy();
    await itBtn!.trigger("click");
    await flushPromises();

    expect(store.setLang).toHaveBeenCalledWith("it");
    expect(wrapper.emitted("change")).toBeTruthy();
    expect(wrapper.find(".toon-lang-toggle-label").text()).toBe("IT");
  });
});
