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
    expect(hrefs).toContain("#darkroom");
    expect(hrefs).toContain("#contact");
    expect(hrefs).toContain("/experiments/");
    expect(hrefs).not.toContain("/#darkroom");
  });

  it("prefixes homepage hashes when on experiments page", () => {
    const wrapper = mount(SiteNav, {
      props: { page: "experiments" },
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
    expect(hrefs).toContain("/#darkroom");
    expect(hrefs).toContain("/#contact");
    const experiments = wrapper.findAll(".nav-links a.magnetic").find((a) => a.attributes("href") === "/experiments/");
    expect(experiments?.attributes("aria-current")).toBe("page");
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
