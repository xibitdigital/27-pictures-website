import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import WordCaption from "./WordCaption.vue";
import type { CaptionModel } from "./captionModel";

function makeCaption(overrides: Partial<CaptionModel> = {}): CaptionModel {
  return {
    key: "1-0",
    index: 0,
    text: "HELLO",
    classes: ["jax-word", "jax-word--bubble", "jax-word--sfx"],
    style: {
      position: "absolute",
      left: "50%",
      top: "20%",
      "pointer-events": "auto",
      cursor: "pointer",
    },
    textStyle: {},
    bubble: null,
    bubbleStyle: null,
    tail: null,
    audio: "sfx/hello.mp3",
    volume: 1,
    x: 0.5,
    y: 0.2,
    ...overrides,
  };
}

function pointer(type: string, clientX: number, clientY: number, pointerId = 1): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId,
    pointerType: "touch",
    isPrimary: true,
    clientX,
    clientY,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
  });
}

describe("WordCaption mobile tap", () => {
  it("plays on a jittery pointer tap within slop (click would be cancelled)", async () => {
    const wrapper = mount(WordCaption, {
      props: { caption: makeCaption() },
      attachTo: document.body,
    });
    const el = wrapper.element as HTMLElement;

    el.dispatchEvent(pointer("pointerdown", 100, 200));
    // 12px vertical jitter — browsers suppress click with touch-action: pan-y
    el.dispatchEvent(pointer("pointerup", 103, 212));

    expect(wrapper.emitted("play")).toHaveLength(1);
    expect(wrapper.emitted("play")![0][0].audio).toBe("sfx/hello.mp3");
    wrapper.unmount();
  });

  it("does not play when the gesture moves past slop (real scroll)", async () => {
    const wrapper = mount(WordCaption, {
      props: { caption: makeCaption() },
      attachTo: document.body,
    });
    const el = wrapper.element as HTMLElement;

    el.dispatchEvent(pointer("pointerdown", 100, 200));
    el.dispatchEvent(pointer("pointerup", 100, 240)); // 40px pan

    expect(wrapper.emitted("play")).toBeUndefined();
    wrapper.unmount();
  });

  it("dedupes pointerup + synthetic click", async () => {
    const wrapper = mount(WordCaption, {
      props: { caption: makeCaption() },
      attachTo: document.body,
    });
    const el = wrapper.element as HTMLElement;

    el.dispatchEvent(pointer("pointerdown", 50, 50));
    el.dispatchEvent(pointer("pointerup", 50, 50));
    await wrapper.trigger("click");

    expect(wrapper.emitted("play")).toHaveLength(1);
    wrapper.unmount();
  });

  it("does not treat non-audio captions as buttons", () => {
    const wrapper = mount(WordCaption, {
      props: { caption: makeCaption({ audio: null, classes: ["jax-word", "jax-word--credit"] }) },
    });
    expect(wrapper.attributes("role")).toBeUndefined();
    expect(wrapper.attributes("tabindex")).toBeUndefined();
    wrapper.unmount();
  });
});
