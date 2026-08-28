import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import PlateCanvas from "./PlateCanvas.vue";
import type { BubbleRecord } from "../types";

const bubble: BubbleRecord = {
  id: "b1",
  x: 0.5,
  y: 0.2,
  variant: "bubble",
  tail: "bottom-left",
  size: 22,
  angle: null,
  textEn: "Hi",
  sort: 0,
};

function mountPlate(replacing = false) {
  return mount(PlateCanvas, {
    props: {
      src: "https://cdn.example/plate.webp",
      pageNum: 3,
      bubbles: [bubble],
      selectedId: null,
      designWidth: 1152,
      designHeight: 1728,
      replacing,
    },
    global: { stubs: { EditorCaptionLayer: true } },
  });
}

describe("PlateCanvas replace plate", () => {
  it("puts a Replace button on the plate", () => {
    const wrapper = mountPlate();
    const btn = wrapper.get('button[name="replace-page"]');
    expect(btn.text()).toContain("Replace");
    expect(btn.classes()).toContain("editor-plate-replace");
    expect(wrapper.get('input[name="replace-page-file"]').attributes("accept")).toBe("image/webp,image/jpeg,image/png");
  });

  it("emits the chosen file without appending a page", async () => {
    const wrapper = mountPlate();
    const input = wrapper.get('input[name="replace-page-file"]');
    const file = new File([new Uint8Array([1, 2, 3])], "plate.webp", { type: "image/webp" });
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");
    expect(wrapper.emitted("replace")).toEqual([[file]]);
  });

  it("disables the control while a replace is in flight", () => {
    const wrapper = mountPlate(true);
    const btn = wrapper.get('button[name="replace-page"]');
    expect(btn.attributes("disabled")).toBeDefined();
    expect(btn.text()).toContain("Replacing");
    expect(wrapper.get('input[name="replace-page-file"]').attributes("disabled")).toBeDefined();
  });
});
