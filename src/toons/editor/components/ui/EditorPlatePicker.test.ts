import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EditorPlatePicker from "./EditorPlatePicker.vue";

describe("EditorPlatePicker", () => {
  it("renders items, selection, badge, and extra class on the grid", async () => {
    const wrapper = mount(EditorPlatePicker, {
      props: {
        ariaLabel: "Toon image gallery",
        items: [
          { key: "a", src: "/a.webp", label: "Image A", badge: "1" },
          { key: "b", src: "/b.webp", label: "Image B", selected: true },
        ],
      },
      attrs: { class: "editor-asset-gallery" },
    });
    expect(wrapper.classes()).toContain("editor-plate-picker");
    expect(wrapper.classes()).toContain("editor-asset-gallery");
    const items = wrapper.findAll(".editor-plate-picker-item");
    expect(items).toHaveLength(2);
    expect(items[1].classes()).toContain("is-selected");
    expect(items[0].get(".editor-plate-picker-num").text()).toBe("1");
    expect(items[1].find(".editor-plate-picker-num").exists()).toBe(false);
    await items[0].trigger("click");
    expect(wrapper.emitted("pick")?.[0]).toEqual(["a"]);
  });
});
