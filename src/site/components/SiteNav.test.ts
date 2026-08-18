import { describe, it, expect, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import SiteNav from "./SiteNav.vue";

// Headless UI Dialog needs Teleport target
describe("SiteNav", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
    document.documentElement.setAttribute("lang", "en");
    window.history.pushState({}, "", "/");
  });

  it("renders desktop section links for home", () => {
    const wrapper = mount(SiteNav, {
      props: { page: "home" },
      attachTo: document.body,
      global: {
        stubs: {
          // Keep Headless pieces simple in unit tests
          TransitionRoot: false,
          TransitionChild: false,
          Dialog: { template: "<div><slot /></div>" },
          DialogPanel: { template: "<div><slot /></div>" },
          DialogTitle: { template: "<div><slot /></div>" },
        },
      },
    });

    const hrefs = wrapper.findAll(".nav-links a.magnetic").map((a) => a.attributes("href"));
    // Section anchors stay bare on the homepage; the split-out pages are absolute.
    expect(hrefs).toContain("#contact");
    expect(hrefs).toContain("/horror-shorts/");
    expect(hrefs).toContain("/cosplay/");
    expect(hrefs).toContain("/toons/");
    expect(hrefs).not.toContain("/#contact");
  });

  it("prefixes homepage hashes when on the toons page", () => {
    const wrapper = mount(SiteNav, {
      props: { page: "toons" },
      attachTo: document.body,
      global: {
        stubs: {
          TransitionRoot: false,
          TransitionChild: false,
          Dialog: { template: "<div><slot /></div>" },
          DialogPanel: { template: "<div><slot /></div>" },
          DialogTitle: { template: "<div><slot /></div>" },
        },
      },
    });

    const hrefs = wrapper.findAll(".nav-links a.magnetic").map((a) => a.attributes("href"));
    expect(hrefs).toContain("/#contact");
    // Dedicated pages are absolute from anywhere.
    expect(hrefs).toContain("/horror-shorts/");
    expect(hrefs).toContain("/cosplay/");
    const toons = wrapper.findAll(".nav-links a.magnetic").find((a) => a.attributes("href") === "/toons/");
    expect(toons?.attributes("aria-current")).toBe("page");
  });

  it("prefixes only translated pages when the document is not English", () => {
    document.documentElement.setAttribute("lang", "it");
    window.history.pushState({}, "", "/it/toons/");

    const wrapper = mount(SiteNav, {
      props: { page: "toons" },
      attachTo: document.body,
      global: {
        stubs: {
          TransitionRoot: false,
          TransitionChild: false,
          Dialog: { template: "<div><slot /></div>" },
          DialogPanel: { template: "<div><slot /></div>" },
          DialogTitle: { template: "<div><slot /></div>" },
        },
      },
    });

    const hrefs = wrapper.findAll(".nav-links a.magnetic").map((a) => a.attributes("href"));
    expect(hrefs).toContain("/it/toons/");
    expect(hrefs).toContain("/it/cosplay/");
    expect(hrefs).toContain("/it/horror-shorts/");
    expect(hrefs).not.toContain("/cosplay/");
    const langs = wrapper.findAll(".nav-links .nav-lang");
    expect(langs.map((a) => a.attributes("href"))).toEqual(
      expect.arrayContaining(["/toons/", "/it/toons/", "/de/toons/", "/fr/toons/"])
    );
    expect(langs).toHaveLength(4);
    const current = langs.find((a) => a.attributes("aria-current") === "true");
    expect(current?.attributes("href")).toBe("/it/toons/");
    expect(current?.attributes("lang")).toBe("it");
    const french = langs.find((a) => a.attributes("hreflang") === "fr");
    expect(french?.text()).toContain("Français");
    expect(french?.attributes("href")).toBe("/fr/toons/");

    document.documentElement.setAttribute("lang", "en");
    window.history.pushState({}, "", "/");
  });

  it("hides the language switcher on pages that have no translation", () => {
    document.documentElement.setAttribute("lang", "en");
    // A reader: its captions are multilingual, the page itself is English only.
    window.history.pushState({}, "", "/toons/nero/");
    const wrapper = mount(SiteNav, {
      props: { page: "toons" },
      attachTo: document.body,
      global: {
        stubs: {
          TransitionRoot: false,
          TransitionChild: false,
          Dialog: { template: "<div><slot /></div>" },
          DialogPanel: { template: "<div><slot /></div>" },
          DialogTitle: { template: "<div><slot /></div>" },
        },
      },
    });
    expect(wrapper.find(".nav-langs").exists()).toBe(false);
    expect(wrapper.find(".nav-lang-select").exists()).toBe(false);
    window.history.pushState({}, "", "/");
  });

  it("navigates when the mobile language select changes", async () => {
    document.documentElement.setAttribute("lang", "it");
    window.history.pushState({}, "", "/it/toons/");

    const wrapper = mount(SiteNav, {
      props: { page: "toons" },
      attachTo: document.body,
      global: {
        stubs: {
          TransitionRoot: { template: "<div v-if='show'><slot /></div>", props: ["show"] },
          TransitionChild: { template: "<div><slot /></div>" },
          Dialog: { template: "<div><slot /></div>" },
          DialogPanel: { template: "<div><slot /></div>" },
          DialogTitle: { template: "<div><slot /></div>" },
        },
      },
    });

    await wrapper.find(".burger-btn").trigger("click");
    const select = wrapper.find("#nav-lang-select");
    expect(select.exists()).toBe(true);
    expect((select.element as HTMLSelectElement).value).toBe("it");
    expect(wrapper.findAll("#nav-lang-select option").map((o) => o.attributes("value"))).toEqual([
      "en",
      "de",
      "it",
      "fr",
    ]);

    const assign = vi.fn();
    vi.spyOn(window.location, "assign").mockImplementation(assign);

    await select.setValue("fr");
    expect(assign).toHaveBeenCalledWith("/fr/toons/");

    vi.restoreAllMocks();
    document.documentElement.setAttribute("lang", "en");
    window.history.pushState({}, "", "/");
  });

  it("toggles burger active class when opened", async () => {
    const wrapper = mount(SiteNav, {
      props: { page: "home" },
      attachTo: document.body,
      global: {
        stubs: {
          TransitionRoot: { template: "<div v-if='show'><slot /></div>", props: ["show"] },
          TransitionChild: { template: "<div><slot /></div>" },
          Dialog: { template: "<div><slot /></div>" },
          DialogPanel: { template: "<div><slot /></div>" },
          DialogTitle: { template: "<div><slot /></div>" },
        },
      },
    });

    const burger = wrapper.find(".burger-btn");
    expect(burger.classes()).not.toContain("active");
    await burger.trigger("click");
    expect(burger.classes()).toContain("active");
    expect(document.body.style.overflow).toBe("hidden");
  });
});
