import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import PlateWatermark from "./PlateWatermark.vue";

vi.mock("./captionModel", () => ({
  imageContentBox: () => ({ left: 10, top: 20, width: 1008, height: 1792 }),
}));

function makeImage(): HTMLImageElement {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: 1008 });
  Object.defineProperty(img, "naturalHeight", { value: 1792 });
  Object.defineProperty(img, "clientWidth", { value: 1008 });
  Object.defineProperty(img, "complete", { value: true });
  document.body.appendChild(img);
  return img;
}

describe("PlateWatermark", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("places the mark at the baked-plate inset once its natural size is known", async () => {
    const wrapper = mount(PlateWatermark, {
      props: { src: "/mark.png", imageEl: makeImage(), designWidth: 1008 },
      attachTo: document.body,
    });
    await nextTick();
    const mark = wrapper.get("img");
    Object.defineProperty(mark.element, "naturalWidth", { value: 120 });
    Object.defineProperty(mark.element, "naturalHeight", { value: 40 });
    await mark.trigger("load");
    const style = mark.attributes("style") || "";
    expect(style).toContain("left: 928px");
    expect(style).toContain("top: 1756px");
    expect(style).toContain("width: 60px");
    expect(style).toContain("height: 20px");
    wrapper.unmount();
  });
});
