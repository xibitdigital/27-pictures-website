import { describe, it, expect, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import CoverFirstPage from "./CoverFirstPage.vue";
import { DEFAULT_COVER_STORY } from "./coverStory";
import { FLIPFRAME } from "./flipframeCopy";

beforeEach(() => {
  document.documentElement.setAttribute("lang", "en");
  window.localStorage.removeItem("27p-locale");
  stubPointer(false);
});

const headlessStubs = {
  TransitionRoot: {
    props: ["show"],
    template: `<div v-if="show"><slot /></div>`,
  },
  TransitionChild: { template: `<div><slot /></div>` },
  Dialog: { template: `<div class="dialog-stub"><slot /></div>` },
  DialogPanel: { template: `<div><slot /></div>` },
  DialogTitle: { template: `<h2><slot /></h2>` },
};

/** jsdom has no pointer media support — stub matchMedia for the plate how-to. */
function stubPointer(coarse: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("pointer: coarse") ? coarse : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function mountPage(props: Record<string, unknown> = {}) {
  return mount(CoverFirstPage, {
    props,
    global: { stubs: headlessStubs },
  });
}

describe("CoverFirstPage", () => {
  it("renders shared first-page structure", () => {
    const wrapper = mountPage({
      title: "Jax",
      subtitle: "Cyberpunk Chronicles",
      synopsis: "A netrunner in the rain.",
      logo: "/logo.png",
      altPrefix: "Jax",
    });

    expect(wrapper.find(".front-cover-title").text()).toBe("Jax");
    expect(wrapper.find(".front-cover-subtitle").text()).toBe("Cyberpunk Chronicles");
    expect(wrapper.find(".front-cover-cast-heading").exists()).toBe(false);
    expect(wrapper.find(".front-cover-synopsis").text()).toMatch(/netrunner/i);
    expect(wrapper.findAll(".front-cover-separator").length).toBe(2);
    expect(wrapper.find(".front-cover-brand-word").text()).toBe("FlipFrame");
    // Build id is injected at Vite config time (git short SHA or VITE_FLIPFRAME_BUILD).
    const buildEl = wrapper.find(".front-cover-brand-build");
    if (import.meta.env.VITE_FLIPFRAME_BUILD) {
      expect(buildEl.exists()).toBe(true);
      expect(buildEl.text()).toMatch(/^build\s+\S+/);
    }
    expect(wrapper.find(".front-cover-howto").exists()).toBe(true);
    expect(wrapper.find(".front-cover-howto-keys").exists()).toBe(true);
    expect(wrapper.find(".front-cover-howto-click").exists()).toBe(true);
    expect(wrapper.find(".front-cover-howto-caption").text()).toMatch(/arrow keys|click on a page/i);
    expect(wrapper.find(".front-cover-howto-heading").exists()).toBe(false);
    expect(wrapper.findAll(".front-cover-manual li").length).toBe(0);
    expect(wrapper.find(".front-cover-logo").exists()).toBe(false);
    expect(wrapper.find(".cover-first-page").classes()).not.toContain("front-cover-instructions--modal");
  });

  it("uses fallback story when synopsis is absent", () => {
    const wrapper = mountPage({ title: "Erin" });
    expect(wrapper.find(".front-cover-synopsis").text()).toBe(DEFAULT_COVER_STORY);
  });

  it("applies modal variant classes", () => {
    const wrapper = mountPage({ title: "Nero", variant: "modal" });
    const root = wrapper.find(".cover-first-page");
    expect(root.classes()).toContain("front-cover-instructions--modal");
    expect(root.classes()).toContain("cover-first-page--modal");
  });

  it("drops the how-to diagram on the modal (mobile) variant, caption only", () => {
    const wrapper = mountPage({ title: "Nero", variant: "modal" });
    expect(wrapper.find(".front-cover-howto-icons").exists()).toBe(false);
    expect(wrapper.find(".front-cover-howto-keys").exists()).toBe(false);
    expect(wrapper.find(".front-cover-howto-click").exists()).toBe(false);
    expect(wrapper.find(".front-cover-howto-caption").text()).toBe(FLIPFRAME.en.howtoScroll);
  });

  it("accepts a title slot (DialogTitle in guide modal)", () => {
    const wrapper = mount(CoverFirstPage, {
      props: { title: "Nero", variant: "modal" },
      slots: {
        title: `<h1 class="front-cover-title slot-title">Slotted Nero</h1>`,
      },
      global: { stubs: headlessStubs },
    });
    expect(wrapper.find(".slot-title").text()).toBe("Slotted Nero");
    expect(wrapper.findAll(".front-cover-title").length).toBe(1);
  });

  it("shows FlipFrame instructions in the landing-page language", () => {
    window.localStorage.setItem("27p-locale", "fr");
    const wrapper = mountPage({ title: "Jax" });
    expect(wrapper.find(".front-cover-howto-caption").text()).toBe(FLIPFRAME.fr.howtoBook);
    expect(wrapper.find(".front-cover-synopsis").text()).toBe(FLIPFRAME.fr.fallbackStory);
  });

  it("emits soundToggle when sound control is used", async () => {
    const wrapper = mountPage({
      soundHint: "Turn the sound on",
      soundEnabled: false,
    });
    await wrapper.find(".front-cover-sound-btn").trigger("click");
    expect(wrapper.emitted("soundToggle")).toHaveLength(1);
  });

  it("drops keyboard and click diagrams on a touch screen, and says tap", async () => {
    // A Pro Max in landscape / an iPad is past the 768px cut-off: book plate,
    // but no arrow keys and no mouse to click with.
    stubPointer(true);
    const wrapper = mountPage({ title: "Nero" });
    await nextTick();
    expect(wrapper.find(".front-cover-howto-icons").exists()).toBe(false);
    expect(wrapper.find(".front-cover-howto-caption").text()).toBe(FLIPFRAME.en.howtoTap);
  });
});
