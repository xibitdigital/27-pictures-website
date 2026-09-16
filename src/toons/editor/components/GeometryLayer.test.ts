import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import GeometryLayer from "./GeometryLayer.vue";
import RegionShape from "./RegionShape.vue";
import EditorIconButton from "./ui/EditorIconButton.vue";
import { toasts } from "../toast";
import type { RegionRecord } from "../types";

/** Same technique the reader's RegionLayer.test.ts uses: a stub <img> with explicit natural/client sizes, since jsdom never loads real images. */
function makeImage(naturalWidth: number, clientWidth: number, clientHeight: number): HTMLImageElement {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: naturalWidth });
  Object.defineProperty(img, "naturalHeight", { value: Math.round((naturalWidth * clientHeight) / clientWidth) });
  Object.defineProperty(img, "clientWidth", { value: clientWidth });
  Object.defineProperty(img, "clientHeight", { value: clientHeight });
  Object.defineProperty(img, "complete", { value: true });
  document.body.appendChild(img);
  return img;
}

function region(overrides: Partial<RegionRecord> = {}): RegionRecord {
  return {
    id: "r1",
    shapeType: "rect",
    geometry: { kind: "rect", x: 0.1, y: 0.1, w: 0.4, h: 0.3 },
    fileKey: null,
    fileUrl: null,
    fileWidth: null,
    fileHeight: null,
    imageOffsetX: 0.5,
    imageOffsetY: 0.5,
    imageScale: 1,
    borderColor: "#ff0000",
    borderWidth: 4,
    borderStyle: "solid",
    sort: 0,
    ...overrides,
  };
}

describe("GeometryLayer border scale", () => {
  it("scales borderWidth by renderedWidth/designWidth, not by the loaded plate's naturalWidth", async () => {
    // The plate <img> here is a capped-resolution export: naturalWidth (1008) differs from
    // the toon's actual designWidth (2016) — exactly the real-world case (flattenNow's export
    // cap) that broke this before. Rendered at clientWidth 504 -> renderedWidth/designWidth =
    // 504/2016 = 0.25. The old (buggy) renderedWidth/naturalWidth would give 0.5 instead.
    const img = makeImage(1008, 504, 896);
    const wrapper = mount(GeometryLayer, {
      props: {
        regions: [region()],
        designWidth: 2016,
        designHeight: 3584,
        imageEl: img,
        interactive: true,
      },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    const shape = wrapper.findComponent(RegionShape);
    expect(shape.exists()).toBe(true);
    expect(shape.props("scale")).toBeCloseTo(0.25, 5);
  });
});

describe("GeometryLayer download button", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    toasts.splice(0, toasts.length);
  });

  it("only shows on the selected region, and only when it has an image", async () => {
    const img = makeImage(1008, 504, 896);
    const wrapper = mount(GeometryLayer, {
      props: {
        regions: [region({ id: "r1", fileUrl: "https://cdn.example/r1.webp" }), region({ id: "r2", fileUrl: null })],
        selectedId: "r1",
        imageEl: img,
        interactive: true,
      },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.findAllComponents(EditorIconButton)).toHaveLength(1);

    await wrapper.setProps({ selectedId: "r2" });
    expect(wrapper.findAllComponents(EditorIconButton)).toHaveLength(0);
  });

  it("fetches the region's image and triggers a same-name download", async () => {
    const img = makeImage(1008, 504, 896);
    const blob = new Blob(["fake image bytes"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    vi.stubGlobal("fetch", fetchMock);
    const createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const wrapper = mount(GeometryLayer, {
      props: {
        regions: [region({ id: "r1", fileUrl: "https://cdn.example/toons/abc123.webp" })],
        selectedId: "r1",
        imageEl: img,
        interactive: true,
      },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();

    await wrapper.findComponent(EditorIconButton).trigger("click");
    await wrapper.vm.$nextTick();
    await vi.waitFor(() => expect(clickSpy).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith("https://cdn.example/toons/abc123.webp");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it("toasts instead of throwing when the download fails", async () => {
    const img = makeImage(1008, 504, 896);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, blob: async () => new Blob([]) }));

    const wrapper = mount(GeometryLayer, {
      props: {
        regions: [region({ id: "r1", fileUrl: "https://cdn.example/missing.webp" })],
        selectedId: "r1",
        imageEl: img,
        interactive: true,
      },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();

    await wrapper.findComponent(EditorIconButton).trigger("click");
    await vi.waitFor(() => expect(toasts.some((t) => t.message.includes("404"))).toBe(true));
  });
});
