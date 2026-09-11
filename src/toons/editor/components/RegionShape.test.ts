import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import RegionShape from "./RegionShape.vue";
import type { RegionRecord } from "../types";

function baseRegion(overrides: Partial<RegionRecord> = {}): RegionRecord {
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

const baseProps = { clipPath: "none", imgStyle: null, frameWidth: 200, frameHeight: 100, scale: 1 };

describe("RegionShape borders", () => {
  it("gives a rect a real CSS border, no SVG overlay", () => {
    const wrapper = mount(RegionShape, {
      props: { ...baseProps, region: baseRegion() },
    });
    const div = wrapper.get(".editor-region");
    expect(div.attributes("style")).toContain("border: 4px solid #ff0000");
    expect(wrapper.find("svg.editor-region-border").exists()).toBe(false);
  });

  it("traces a polygon's actual points in real pixel coordinates (no viewBox), not a box-shadow", () => {
    const region = baseRegion({
      shapeType: "polygon",
      // bbox is x:[0,1] y:[0,1] (full 0-1 square) so percent-of-bbox == the raw fraction * 100
      geometry: {
        kind: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 1 }, // an interior/diagonal vertex — the case box-shadow couldn't render at all
        ],
      },
      borderWidth: 3,
      borderColor: "#00ff00",
    });
    const wrapper = mount(RegionShape, {
      props: { ...baseProps, region, clipPath: "polygon(0% 0%)", frameWidth: 200, frameHeight: 100 },
    });
    // no box-shadow border on the clipped div for a polygon
    const div = wrapper.get(".editor-region");
    expect(div.attributes("style") || "").not.toContain("box-shadow");
    const svg = wrapper.get("svg.editor-region-border");
    // no viewBox — points are plain frame-pixel coordinates, same technique as GeometryLayer's draft-polygon overlay
    expect(svg.attributes("viewBox")).toBeUndefined();
    const polygon = svg.get("polygon");
    expect(polygon.attributes("stroke")).toBe("#00ff00");
    expect(polygon.attributes("stroke-width")).toBe("3");
    expect(polygon.attributes("fill")).toBe("none");
    expect(polygon.attributes("points")).toBe("0,0 200,0 100,100");
  });

  it("scales borderWidth by the studio canvas's design-px-to-screen-px ratio, for both a rect and a polygon", () => {
    const rectWrapper = mount(RegionShape, {
      props: { ...baseProps, region: baseRegion({ borderWidth: 4 }), scale: 0.5 },
    });
    expect(rectWrapper.get(".editor-region").attributes("style")).toContain("border: 2px solid #ff0000");

    const polygonWrapper = mount(RegionShape, {
      props: {
        ...baseProps,
        scale: 0.5,
        region: baseRegion({
          shapeType: "polygon",
          geometry: {
            kind: "polygon",
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0.5, y: 1 },
            ],
          },
          borderWidth: 3,
        }),
      },
    });
    expect(polygonWrapper.get("svg.editor-region-border polygon").attributes("stroke-width")).toBe("1.5");
  });

  it("renders no border SVG when borderWidth is 0", () => {
    const region = baseRegion({
      shapeType: "polygon",
      geometry: {
        kind: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 1 },
        ],
      },
      borderWidth: 0,
    });
    const wrapper = mount(RegionShape, { props: { ...baseProps, region, clipPath: "polygon(0% 0%)" } });
    expect(wrapper.find("svg.editor-region-border").exists()).toBe(false);
  });

  it("applies a dash pattern for a dashed polygon border", () => {
    const region = baseRegion({
      shapeType: "polygon",
      geometry: {
        kind: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 1 },
        ],
      },
      borderWidth: 2,
      borderStyle: "dashed",
    });
    const wrapper = mount(RegionShape, { props: { ...baseProps, region, clipPath: "polygon(0% 0%)" } });
    const polygon = wrapper.get("svg.editor-region-border polygon");
    expect(polygon.attributes("stroke-dasharray")).toBeTruthy();
  });
});
