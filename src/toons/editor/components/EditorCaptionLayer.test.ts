import { describe, it, expect, afterEach, vi } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import EditorCaptionLayer from "./EditorCaptionLayer.vue";
import type { BubbleRecord } from "../types";

function makeImage(): HTMLImageElement {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 1424 });
  Object.defineProperty(img, "clientWidth", { value: 400 });
  Object.defineProperty(img, "clientHeight", { value: 712 });
  Object.defineProperty(img, "complete", { value: true });
  document.body.appendChild(img);
  return img;
}

function bubble(partial: Partial<BubbleRecord> = {}): BubbleRecord {
  return {
    id: "b1",
    x: 0.5,
    y: 0.25,
    variant: "bubble",
    tail: "bottom-left",
    size: 22,
    angle: null,
    textEn: "HELLO",
    sort: 0,
    ...partial,
  };
}

function pointer(type: string, clientX: number, clientY: number, pointerId = 1): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId,
    pointerType: "mouse",
    isPrimary: true,
    clientX,
    clientY,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
  });
}

describe("EditorCaptionLayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders WordCaption for each bubble", async () => {
    const wrapper = mount(EditorCaptionLayer, {
      props: { pageNum: 1, bubbles: [bubble()], imageEl: makeImage() },
      attachTo: document.body,
    });
    await nextTick();
    const caption = wrapper.find(".jax-word");
    expect(caption.exists()).toBe(true);
    expect(caption.text()).toBe("HELLO");
    expect(caption.attributes("data-bubble-id")).toBe("b1");
    wrapper.unmount();
  });

  it("emits persist with clamped plate fractions on drag end", async () => {
    const wrapper = mount(EditorCaptionLayer, {
      props: { pageNum: 1, bubbles: [bubble()], imageEl: makeImage() },
      attachTo: document.body,
    });
    await nextTick();
    const layer = wrapper.find(".editor-word-layer").element as HTMLElement;
    vi.spyOn(layer, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 712,
      width: 400,
      height: 712,
      toJSON: () => ({}),
    } as DOMRect);

    const el = wrapper.find(".jax-word").element as HTMLElement;
    el.dispatchEvent(pointer("pointerdown", 200, 178));
    window.dispatchEvent(pointer("pointermove", 240, 250));
    // Drop off the caption — the previous listener lived only on the overlay,
    // so a release outside it never committed.
    window.dispatchEvent(pointer("pointerup", 500, 800));
    await nextTick();

    const persist = wrapper.emitted("persist");
    expect(persist).toBeTruthy();
    const [, x, y] = persist![0] as [string, number, number];
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThanOrEqual(1);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThanOrEqual(1);
    wrapper.unmount();
  });

  it("rings the selected bubble with nine tail buttons and emits tail", async () => {
    const wrapper = mount(EditorCaptionLayer, {
      props: { pageNum: 1, bubbles: [bubble()], selectedId: "b1", imageEl: makeImage() },
      attachTo: document.body,
    });
    await nextTick();
    const ring = wrapper.get("[data-tail-ring]");
    const buttons = ring.findAll("[data-tail]");
    expect(buttons).toHaveLength(9);
    expect(ring.get('[data-tail="bottom-left"]').attributes("aria-pressed")).toBe("true");
    await ring.get('[data-tail="right"]').trigger("click");
    expect(wrapper.emitted("tail")).toEqual([["b1", "right"]]);
    wrapper.unmount();
  });

  it("emits add when the empty plate is clicked", async () => {
    const wrapper = mount(EditorCaptionLayer, {
      props: { pageNum: 1, bubbles: [], imageEl: makeImage() },
      attachTo: document.body,
    });
    await nextTick();
    const layer = wrapper.find(".editor-word-layer").element as HTMLElement;
    vi.spyOn(layer, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 712,
      width: 400,
      height: 712,
      toJSON: () => ({}),
    } as DOMRect);
    layer.dispatchEvent(pointer("pointerdown", 100, 178));
    await nextTick();
    expect(wrapper.emitted("add")?.[0][0]).toEqual({ x: 0.25, y: 0.25 });
    wrapper.unmount();
  });
});
