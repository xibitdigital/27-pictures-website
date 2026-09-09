import { describe, it, expect, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import RegionLayer from "./RegionLayer.vue";
import { clipPathPolygon, coverImageRect, regionBoundingBox } from "../../editor/regionFit";
import type { ReaderRegion } from "../types";

/** Same stub WordLayer.test.ts uses: exact 0.5 scale, no object-fit letterboxing. */
function makeImage(): HTMLImageElement {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: 1008 });
  Object.defineProperty(img, "naturalHeight", { value: 1792 });
  Object.defineProperty(img, "clientWidth", { value: 504 });
  Object.defineProperty(img, "clientHeight", { value: 896 });
  Object.defineProperty(img, "complete", { value: true });
  document.body.appendChild(img);
  return img;
}

const rectRegion: ReaderRegion = {
  shapeType: "rect",
  geometry: { kind: "rect", x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
  file: "assets/region-a.webp",
  fileWidth: 200,
  fileHeight: 100,
  imageOffsetX: 0.5,
  imageOffsetY: 0.5,
  imageScale: 1,
  sort: 0,
};

const polygonRegion: ReaderRegion = {
  shapeType: "polygon",
  geometry: {
    kind: "polygon",
    points: [
      { x: 0.5, y: 0.5 },
      { x: 0.9, y: 0.5 },
      { x: 0.7, y: 0.9 },
    ],
  },
  file: "assets/region-b.webp",
  fileWidth: 150,
  fileHeight: 300,
  imageOffsetX: 0.2,
  imageOffsetY: 0.8,
  imageScale: 1.2,
  sort: 1,
};

const BOX = { width: 504, height: 896 }; // makeImage()'s exact 0.5-scale content box, no letterbox

function expectedFrame(region: ReaderRegion) {
  const bbox = regionBoundingBox(region.geometry);
  return {
    left: bbox.x * BOX.width,
    top: bbox.y * BOX.height,
    width: bbox.w * BOX.width,
    height: bbox.h * BOX.height,
    clipPath: clipPathPolygon(region.geometry, bbox),
  };
}

function expectedImg(region: ReaderRegion, natural: { width: number; height: number }) {
  const bbox = regionBoundingBox(region.geometry);
  return coverImageRect(
    { width: bbox.w * BOX.width, height: bbox.h * BOX.height },
    natural,
    region.imageScale,
    region.imageOffsetX,
    region.imageOffsetY
  );
}

/** Vue's style serializer can round a px value slightly differently than raw JS
 * string interpolation (e.g. "50.4px" vs "50.400000000000006px") — compare the
 * parsed number instead of the exact substring. */
function styleValue(style: string, prop: string): number {
  const match = new RegExp(`${prop}:\\s*(-?[\\d.]+)px`).exec(style);
  if (!match) throw new Error(`style has no ${prop}: ${style}`);
  return Number(match[1]);
}

function expectStyleCloseTo(style: string, prop: string, expected: number): void {
  expect(styleValue(style, prop)).toBeCloseTo(expected, 5);
}

describe("RegionLayer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders nothing when regions is empty", async () => {
    const wrapper = mount(RegionLayer, {
      props: { pageNum: 1, regions: [], imageEl: makeImage() },
      attachTo: document.body,
    });
    await nextTick();
    expect(wrapper.findAll("img")).toHaveLength(0);
  });

  it("positions the layer to the backdrop image's measured content box", async () => {
    const wrapper = mount(RegionLayer, {
      props: { pageNum: 1, regions: [rectRegion], imageEl: makeImage() },
      attachTo: document.body,
    });
    await nextTick();
    const style = wrapper.find(".jax-region-layer").attributes("style") || "";
    expect(style).toContain(`width: ${BOX.width}px`);
    expect(style).toContain(`height: ${BOX.height}px`);
    expect(style).toContain("z-index: 20");
    expect(style).toContain("pointer-events: none");
  });

  it("lays out a rect region using regionBoundingBox/coverImageRect/clipPathPolygon, matching the editor's own math", async () => {
    const wrapper = mount(RegionLayer, {
      props: { pageNum: 1, regions: [rectRegion], imageEl: makeImage() },
      attachTo: document.body,
    });
    await nextTick();
    const frame = expectedFrame(rectRegion);
    const img = expectedImg(rectRegion, {
      width: rectRegion.fileWidth as number,
      height: rectRegion.fileHeight as number,
    });

    const frameEl = wrapper.find("[style*='clip-path']");
    const frameStyle = frameEl.attributes("style") || "";
    expectStyleCloseTo(frameStyle, "left", frame.left);
    expectStyleCloseTo(frameStyle, "top", frame.top);
    expectStyleCloseTo(frameStyle, "width", frame.width);
    expectStyleCloseTo(frameStyle, "height", frame.height);
    expect(frameStyle).toContain(frame.clipPath);

    const imgEl = wrapper.find("img");
    expect(imgEl.attributes("src")).toBe(rectRegion.file);
    const imgStyle = imgEl.attributes("style") || "";
    expectStyleCloseTo(imgStyle, "left", img.x);
    expectStyleCloseTo(imgStyle, "top", img.y);
    expectStyleCloseTo(imgStyle, "width", img.width);
    expectStyleCloseTo(imgStyle, "height", img.height);
  });

  it("lays out a polygon region the same way", async () => {
    const wrapper = mount(RegionLayer, {
      props: { pageNum: 1, regions: [polygonRegion], imageEl: makeImage() },
      attachTo: document.body,
    });
    await nextTick();
    const frame = expectedFrame(polygonRegion);
    const frameEl = wrapper.find("[style*='clip-path']");
    const frameStyle = frameEl.attributes("style") || "";
    expectStyleCloseTo(frameStyle, "width", frame.width);
    expectStyleCloseTo(frameStyle, "height", frame.height);
    expect(frameStyle).toContain(frame.clipPath);
  });

  it("re-computes cover-fit off the region's own naturalWidth/Height once its image loads, not the stored dims", async () => {
    const wrapper = mount(RegionLayer, {
      props: { pageNum: 1, regions: [rectRegion], imageEl: makeImage() },
      attachTo: document.body,
    });
    await nextTick();
    // Stored fileWidth/fileHeight (200x100) differ from what the real file turns out to be.
    const imgEl = wrapper.find("img").element as HTMLImageElement;
    Object.defineProperty(imgEl, "naturalWidth", { value: 400, configurable: true });
    Object.defineProperty(imgEl, "naturalHeight", { value: 250, configurable: true });
    await imgEl.dispatchEvent(new Event("load"));
    await wrapper.vm.$nextTick();

    const expected = expectedImg(rectRegion, { width: 400, height: 250 });
    const imgStyle = wrapper.find("img").attributes("style") || "";
    expectStyleCloseTo(imgStyle, "width", expected.width);
    expectStyleCloseTo(imgStyle, "height", expected.height);
  });

  it("renders one image per region in sort order", async () => {
    const wrapper = mount(RegionLayer, {
      props: { pageNum: 1, regions: [rectRegion, polygonRegion], imageEl: makeImage() },
      attachTo: document.body,
    });
    await nextTick();
    const srcs = wrapper.findAll("img").map((el) => el.attributes("src"));
    expect(srcs).toEqual([rectRegion.file, polygonRegion.file]);
  });
});
