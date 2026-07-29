import { describe, it, expect, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import SiteApp from "./SiteApp.vue";

const headlessStubs = {
  TransitionRoot: false,
  TransitionChild: false,
  Dialog: { template: "<div><slot /></div>" },
  DialogPanel: { template: "<div><slot /></div>" },
  DialogTitle: { template: "<div><slot /></div>" },
};

describe("SiteApp", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  it("renders nav on home and teleports ContactForm into #contact-form-app", () => {
    const host = document.createElement("div");
    host.id = "contact-form-app";
    document.body.appendChild(host);

    const wrapper = mount(SiteApp, {
      props: { page: "home" },
      attachTo: document.body,
      global: { stubs: headlessStubs },
    });

    expect(wrapper.findComponent({ name: "SiteNav" }).exists() || wrapper.find("header").exists()).toBe(true);
    // Teleport target receives the form
    expect(host.querySelector("form.contact-form")).toBeTruthy();
    expect(host.querySelector("#name")).toBeTruthy();
  });

  it("does not teleport contact form on experiments page", () => {
    const host = document.createElement("div");
    host.id = "contact-form-app";
    document.body.appendChild(host);

    mount(SiteApp, {
      props: { page: "experiments" },
      attachTo: document.body,
      global: { stubs: headlessStubs },
    });

    expect(host.querySelector("form.contact-form")).toBeNull();
  });

  it("defaults page to home", () => {
    const host = document.createElement("div");
    host.id = "contact-form-app";
    document.body.appendChild(host);

    mount(SiteApp, {
      attachTo: document.body,
      global: { stubs: headlessStubs },
    });

    expect(host.querySelector("form.contact-form")).toBeTruthy();
  });
});
