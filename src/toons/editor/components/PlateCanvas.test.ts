import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import PlateCanvas from "./PlateCanvas.vue";
import type { BubbleRecord } from "../types";

const HINT_KEY = "editor-plate-click-hint";

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
  afterEach(() => {
    localStorage.removeItem(HINT_KEY);
  });

  it("renders the plate image", () => {
    const wrapper = mountPlate();
    expect(wrapper.get("img").attributes("src")).toBe("https://cdn.example/plate.webp");
  });

  it("explains clicking the page to add a bubble until dismissed", async () => {
    const first = mountPlate();
    expect(first.get("[data-plate-hint]").text()).toContain("Click the page to add a bubble");
    await first.get('button[name="dismiss-plate-hint"]').trigger("click");
    expect(first.find("[data-plate-hint]").exists()).toBe(false);
    first.unmount();
    const again = mountPlate();
    expect(again.find("[data-plate-hint]").exists()).toBe(false);
    again.unmount();
  });
});
