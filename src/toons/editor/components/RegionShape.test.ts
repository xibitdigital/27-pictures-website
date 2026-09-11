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

describe("RegionShape borders", () => {
  it("gives a rect a real CSS border, no SVG overlay", () => {
    const wrapper = mount(RegionShape, {
      props: { region: baseRegion(), clipPath: "none", imgStyle: null },
    });
    const div = wrapper.get(".editor-region");
    expect(div.attributes("style")).toContain("border: 4px solid #ff0000");
    expect(wrapper.find("svg.editor-region-border").exists()).toBe(false);
  });

  it("traces a polygon's actual points with an SVG stroke instead of a box-shadow", () => {
    const region = baseRegion({
      shapeType: "polygon",
      geometry: {
        kind: "polygon",
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.5, y: 0.1 },
          { x: 0.3, y: 0.4 }, // an interior/diagonal vertex — the case box-shadow couldn't render at all
        ],
      },
      borderWidth: 3,
      borderColor: "#00ff00",
    });
    const wrapper = mount(RegionShape, { props: { region, clipPath: "polygon(0% 0%)", imgStyle: null } });
    // no box-shadow border on the clipped div for a polygon
    const div = wrapper.get(".editor-region");
    expect(div.attributes("style") || "").not.toContain("box-shadow");
    const svg = wrapper.get("svg.editor-region-border");
    const polygon = svg.get("polygon");
    expect(polygon.attributes("stroke")).toBe("#00ff00");
    expect(polygon.attributes("stroke-width")).toBe("3");
    expect(polygon.attributes("fill")).toBe("none");
    expect(polygon.attributes("vector-effect")).toBe("non-scaling-stroke");
    // 3 points, each "x,y" in 0-100 (percent of the shape's own bbox) — bbox here is x:[0.1,0.5] y:[0.1,0.4]
    const points = polygon.attributes("points")!.split(" ");
    expect(points).toHaveLength(3);
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
    const wrapper = mount(RegionShape, { props: { region, clipPath: "polygon(0% 0%)", imgStyle: null } });
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
    const wrapper = mount(RegionShape, { props: { region, clipPath: "polygon(0% 0%)", imgStyle: null } });
    const polygon = wrapper.get("svg.editor-region-border polygon");
    expect(polygon.attributes("stroke-dasharray")).toBeTruthy();
  });
});
