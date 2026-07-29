import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import FrontCoverInstructions from "./FrontCoverInstructions.vue";

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

function mountCover(props: Record<string, unknown> = {}) {
  return mount(FrontCoverInstructions, {
    props,
    global: { stubs: headlessStubs },
  });
}

describe("FrontCoverInstructions", () => {
  it("renders title, brand, and how-to list", () => {
    const wrapper = mountCover({
      title: "Jax",
      subtitle: "Experiment",
      logo: "/logo.png",
      altPrefix: "Jax",
    });

    expect(wrapper.find(".front-cover-title").text()).toBe("Jax");
    expect(wrapper.find(".front-cover-subtitle").text()).toBe("Experiment");
    expect(wrapper.find(".front-cover-brand-word").text()).toBe("FlipFrame");
    expect(wrapper.find(".front-cover-brand-by").text()).toMatch(/twentyseven/i);
    expect(wrapper.find(".front-cover-logo").attributes("src")).toBe("/logo.png");
    expect(wrapper.find("h2").text()).toBe("How to read");
    expect(wrapper.findAll("li").length).toBe(5);
  });

  it("opens About FlipFrame dialog with contact link", async () => {
    const wrapper = mountCover({ title: "Jax" });

    expect(wrapper.find(".dialog-stub").exists()).toBe(false);

    await wrapper.find(".front-cover-brand-info").trigger("click");

    expect(wrapper.find(".dialog-stub").exists()).toBe(true);
    expect(wrapper.text()).toMatch(/beta product/i);
    expect(wrapper.text()).toMatch(/twentyseven\.pictures/i);
    const link = wrapper.find('a[href="/#contact"]');
    expect(link.exists()).toBe(true);
    expect(link.text()).toMatch(/Contact us/i);
  });

  it("omits sound control when soundHint is absent", () => {
    const wrapper = mountCover({ title: "Erin" });
    expect(wrapper.find(".front-cover-sound-btn").exists()).toBe(false);
  });

  it("shows sound control and emits soundToggle", async () => {
    const wrapper = mountCover({
      soundHint: "Turn the sound on",
      soundEnabled: false,
    });

    const btn = wrapper.find(".front-cover-sound-btn");
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("title")).toBe("Enable sound");
    expect(btn.classes()).not.toContain("is-active");
    expect(btn.find("span").text()).toBe("Turn the sound on");

    await btn.trigger("click");
    expect(wrapper.emitted("soundToggle")).toHaveLength(1);
  });

  it("reflects sound enabled state", () => {
    const wrapper = mountCover({
      soundHint: "Turn the sound on",
      soundEnabled: true,
    });

    const btn = wrapper.find(".front-cover-sound-btn");
    expect(btn.classes()).toContain("is-active");
    expect(btn.classes()).toContain("is-enabled");
    expect(btn.attributes("title")).toBe("Mute sound");
    expect(btn.find("span").text()).toBe("Sound on");
  });
});
