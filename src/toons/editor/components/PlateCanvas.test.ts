import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import PlateCanvas from "./PlateCanvas.vue";
import type { BubbleRecord, RegionRecord } from "../types";

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

describe("PlateCanvas Layout-page regions", () => {
  const filledRegion: RegionRecord = {
    id: "r1",
    shapeType: "rect",
    geometry: { kind: "rect", x: 0.1, y: 0.1, w: 0.4, h: 0.3 },
    fileKey: "region.webp",
    fileUrl: "https://cdn.example/region.webp",
    fileWidth: 300,
    fileHeight: 200,
    imageOffsetX: 0.5,
    imageOffsetY: 0.5,
    imageScale: 1,
    borderColor: null,
    borderWidth: 0,
    borderStyle: "solid",
    sort: 0,
  };

  function mountLayoutPlate(studioMode: "layout" | "bubbles"): VueWrapper {
    return mount(PlateCanvas, {
      props: {
        src: "https://cdn.example/plate.webp",
        pageNum: 1,
        bubbles: [],
        selectedId: null,
        designWidth: 1152,
        designHeight: 1728,
        kind: "layout",
        regions: [filledRegion],
        studioMode,
      },
      attachTo: document.body,
      global: { stubs: { EditorCaptionLayer: true } },
    });
  }

  /** GeometryLayer measures its content box off the plate <img>'s real dimensions — jsdom never lays these out on its own. */
  async function stubPlateImageLoaded(wrapper: VueWrapper): Promise<void> {
    const plateImg = wrapper.find(".editor-plate > img").element as HTMLImageElement;
    Object.defineProperty(plateImg, "naturalWidth", { value: 1152, configurable: true });
    Object.defineProperty(plateImg, "naturalHeight", { value: 1728, configurable: true });
    Object.defineProperty(plateImg, "clientWidth", { value: 576, configurable: true });
    Object.defineProperty(plateImg, "clientHeight", { value: 864, configurable: true });
    Object.defineProperty(plateImg, "complete", { value: true, configurable: true });
    plateImg.dispatchEvent(new Event("load"));
    await nextTick();
  }

  it("still shows a region's real image in Bubbles mode, not just the low-res flattened plate", async () => {
    const wrapper = mountLayoutPlate("bubbles");
    await stubPlateImageLoaded(wrapper);
    const regionImg = wrapper.find('[data-region-id="r1"] img');
    expect(regionImg.exists()).toBe(true);
    expect(regionImg.attributes("src")).toBe("https://cdn.example/region.webp");
    // Non-interactive: takes no pointer input, so it can never fight with caption placement.
    expect(wrapper.get(".editor-geometry-layer").attributes("style")).toContain("pointer-events: none");
    // The mode switcher stays (to switch back to Layout), but its draw tools don't.
    expect(wrapper.find('button[name="tool-rect"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("keeps the region layer interactive in Layout mode", async () => {
    const wrapper = mountLayoutPlate("layout");
    await stubPlateImageLoaded(wrapper);
    const regionImg = wrapper.find('[data-region-id="r1"] img');
    expect(regionImg.exists()).toBe(true);
    expect(wrapper.get(".editor-geometry-layer").attributes("style")).toContain("pointer-events: auto");
    expect(wrapper.find('button[name="tool-rect"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
