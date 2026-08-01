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
    expect(wrapper.find(".front-cover-logo").exists()).toBe(false);
    expect(wrapper.find(".front-cover-howto").exists()).toBe(true);
    expect(wrapper.find(".front-cover-howto-keys").exists()).toBe(true);
    expect(wrapper.find(".front-cover-howto-click").exists()).toBe(true);
    expect(wrapper.find(".front-cover-howto-caption").text()).toMatch(/arrow keys|click on a page/i);
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

  it("renders story synopsis when provided, before FlipFrame / how-to", () => {
    const wrapper = mountCover({
      title: "Nero",
      synopsis: "Nero — detective.\n\nEve — forensics.",
    });
    expect(wrapper.find(".front-cover-cast-heading").exists()).toBe(false);
    expect(wrapper.find(".front-cover-story").exists()).toBe(true);
    expect(wrapper.find(".front-cover-synopsis").text()).toMatch(/detective/i);
    expect(wrapper.find(".front-cover-synopsis").text()).toMatch(/forensics/i);
    expect(wrapper.findAll(".front-cover-separator").length).toBe(2);
    expect(wrapper.find(".front-cover-separator--before-story").exists()).toBe(true);
    expect(wrapper.find(".front-cover-separator--after-story").exists()).toBe(true);
    expect(wrapper.find(".front-cover-manual").exists()).toBe(true);
    const html = wrapper.find(".front-cover-instructions").html();
    const beforeAt = html.indexOf("front-cover-separator--before-story");
    const storyAt = html.indexOf("front-cover-synopsis");
    const afterAt = html.indexOf("front-cover-separator--after-story");
    const brandAt = html.indexOf("front-cover-brand");
    const howtoAt = html.indexOf("front-cover-howto");
    expect(beforeAt).toBeGreaterThan(-1);
    expect(storyAt).toBeGreaterThan(beforeAt);
    expect(afterAt).toBeGreaterThan(storyAt);
    expect(brandAt).toBeGreaterThan(afterAt);
    expect(howtoAt).toBeGreaterThan(brandAt);
  });

  it("always shows story block with fallback when synopsis is absent", () => {
    const wrapper = mountCover({ title: "Jax" });
    expect(wrapper.find(".front-cover-story").exists()).toBe(true);
    expect(wrapper.find(".front-cover-synopsis").exists()).toBe(true);
    expect(wrapper.find(".front-cover-synopsis").text()).toMatch(/FlipFrame experiment/i);
    expect(wrapper.findAll(".front-cover-separator").length).toBe(2);
    expect(wrapper.find(".front-cover-manual").exists()).toBe(true);
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
