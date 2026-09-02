import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PageFilmstrip from "./PageFilmstrip.vue";

vi.mock("vue-router", () => ({
  RouterLink: { template: "<a><slot /></a>" },
}));

describe("PageFilmstrip", () => {
  it("emits generate from the Generate control", async () => {
    const wrapper = mount(PageFilmstrip, {
      props: { toonId: "t1", pages: [], activeId: null, canGenerate: true },
    });
    await wrapper.get('button[name="add-page-generate"]').trigger("click");
    expect(wrapper.emitted("generate")).toHaveLength(1);
  });

  it("still offers Generate when the series has no flow yet", async () => {
    const wrapper = mount(PageFilmstrip, {
      props: { toonId: "t1", pages: [], activeId: null, canGenerate: false },
    });
    const btn = wrapper.get('button[name="add-page-generate"]');
    expect(btn.attributes("disabled")).toBeUndefined();
    await btn.trigger("click");
    expect(wrapper.emitted("generate")).toHaveLength(1);
  });

  it("puts Add page after the existing thumbs", () => {
    const wrapper = mount(PageFilmstrip, {
      props: {
        toonId: "t1",
        pages: [
          {
            id: "p1",
            position: 0,
            fileUrl: "/p1.webp",
            fileKey: "p1",
            width: 800,
            height: 1424,
            bubbles: [],
          },
          {
            id: "p2",
            position: 1,
            fileUrl: "/p2.webp",
            fileKey: "p2",
            width: 800,
            height: 1424,
            bubbles: [],
          },
        ],
        activeId: "p1",
      },
    });
    const kids = [...wrapper.get("nav").element.children].map((el) => el.className);
    expect(kids.at(-1)).toContain("editor-filmstrip-add-wrap");
    expect(kids.slice(0, -1).every((c) => c.includes("editor-thumb"))).toBe(true);
  });
});
