import { describe, it, expect, afterEach, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { vMagnetic } from "./magnetic";

function mountMagnetic() {
  const Comp = defineComponent({
    template: `<button class="mag" v-magnetic type="button">Go</button>`,
  });
  return mount(Comp, {
    global: { directives: { magnetic: vMagnetic } },
    attachTo: document.body,
  });
}

describe("vMagnetic", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("translates element toward the cursor on mousemove", async () => {
    const wrapper = mountMagnetic();
    const el = wrapper.find(".mag").element as HTMLElement;
    el.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 50,
        width: 40,
        height: 20,
        right: 140,
        bottom: 70,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      }) as DOMRect;

    el.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 140, clientY: 70, bubbles: true })
    );
    await nextTick();

    // center = (120, 60); offset = (20, 10); * 0.12 = (2.4, 1.2)
    expect(el.style.transform).toBe("translate(2.4px, 1.2px)");
  });

  it("resets transform on mouseleave", async () => {
    const wrapper = mountMagnetic();
    const el = wrapper.find(".mag").element as HTMLElement;
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    el.dispatchEvent(new MouseEvent("mousemove", { clientX: 80, clientY: 80 }));
    el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    await nextTick();

    expect(el.style.transform).toBe("translate(0px, 0px)");
  });

  it("removes listeners on unmount", () => {
    const wrapper = mountMagnetic();
    const el = wrapper.find(".mag").element as HTMLElement;
    const removeSpy = vi.spyOn(el, "removeEventListener");
    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("mouseleave", expect.any(Function));
  });
});
