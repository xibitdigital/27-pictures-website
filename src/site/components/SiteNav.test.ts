import { describe, it, expect, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import SiteNav from "./SiteNav.vue";

// Headless UI Dialog needs Teleport target
describe("SiteNav", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
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
