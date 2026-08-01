import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CoverGuideDialog from "./CoverGuideDialog.vue";

const headlessStubs = {
  TransitionRoot: {
    props: ["show"],
    template: `<div v-if="show" class="transition-root"><slot /></div>`,
  },
  TransitionChild: { template: `<div><slot /></div>` },
  Dialog: {
    template: `<div class="dialog-stub" @click="$emit('close')"><slot /></div>`,
  },
  DialogPanel: { template: `<div class="dialog-panel-stub"><slot /></div>` },
  DialogTitle: { template: `<h1><slot /></h1>` },
};

function mountGuide(props: Record<string, unknown> = {}) {
  return mount(CoverGuideDialog, {
    props: {
      open: true,
      title: "Nero",
      subtitle: "Scotland Yard case",
      synopsis: "Detective Nero and Eve hunt The Dog.",
      ...props,
    },
    global: { stubs: headlessStubs },
  });
}

describe("CoverGuideDialog", () => {
  it("renders title, subtitle, synopsis, and how-to when open", () => {
    const wrapper = mountGuide();

    expect(wrapper.find(".cover-guide-title").text()).toBe("Nero");
    expect(wrapper.find(".cover-guide-subtitle").text()).toMatch(/Scotland Yard/i);
    expect(wrapper.find(".cover-guide-synopsis").text()).toMatch(/Detective Nero/i);
    expect(wrapper.find(".cover-guide-howto").exists()).toBe(true);
    expect(wrapper.findAll(".cover-guide-howto li").length).toBe(4);
    expect(wrapper.find(".cover-guide-cta").text()).toMatch(/Start reading/i);
  });

  it("hides panel content when closed", () => {
    const wrapper = mountGuide({ open: false });
    expect(wrapper.find(".cover-guide-panel").exists()).toBe(false);
    expect(wrapper.find(".transition-root").exists()).toBe(false);
  });

  it("omits story section when synopsis is absent", () => {
    const wrapper = mountGuide({ synopsis: null });
    expect(wrapper.find(".cover-guide-story").exists()).toBe(false);
    expect(wrapper.find(".cover-guide-howto").exists()).toBe(true);
  });

  it("emits update:open false on Start reading", async () => {
    const wrapper = mountGuide();
    await wrapper.find(".cover-guide-cta").trigger("click");
    const emitted = wrapper.emitted("update:open");
    expect(emitted?.length).toBeGreaterThanOrEqual(1);
    expect(emitted?.[0]).toEqual([false]);
  });

  it("emits update:open false on close button", async () => {
    const wrapper = mountGuide();
    await wrapper.find(".cover-guide-close").trigger("click");
    const emitted = wrapper.emitted("update:open");
    expect(emitted?.length).toBeGreaterThanOrEqual(1);
    expect(emitted?.[0]).toEqual([false]);
  });

  it("falls back to Story title when title is empty", () => {
    const wrapper = mountGuide({ title: "" });
    expect(wrapper.find(".cover-guide-title").text()).toBe("Story");
  });
});
