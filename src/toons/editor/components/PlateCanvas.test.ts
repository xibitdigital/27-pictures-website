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

function mountPlate() {
  return mount(PlateCanvas, {
    props: {
      src: "https://cdn.example/plate.webp",
      pageNum: 3,
      bubbles: [bubble],
      selectedId: null,
      designWidth: 1152,
      designHeight: 1728,
    },
    global: { stubs: { EditorCaptionLayer: true } },
  });
}

describe("PlateCanvas", () => {
  it("renders the plate image", () => {
    const wrapper = mountPlate();
    expect(wrapper.get("img").attributes("src")).toBe("https://cdn.example/plate.webp");
  });
});
