import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EditorColorField from "./EditorColorField.vue";

describe("EditorColorField", () => {
  it("renders the swatch and text inputs in the shared color row", () => {
    const wrapper = mount(EditorColorField, {
      props: {
        modelValue: "#b30000",
        swatch: "#b30000",
        name: "color",
        swatchName: "color-swatch",
        ariaLabel: "Lettering color",
      },
    });
    expect(wrapper.classes()).toContain("editor-color-row");
    expect(wrapper.get('input[type="color"]').attributes("name")).toBe("color-swatch");
    expect(wrapper.get('input[type="text"]').attributes("name")).toBe("color");
    expect((wrapper.get('input[type="text"]').element as HTMLInputElement).value).toBe("#b30000");
  });

  it("emits update:modelValue from the text field and picker from the swatch", async () => {
    const wrapper = mount(EditorColorField, {
      props: {
        modelValue: "",
        swatch: "#111111",
        name: "color",
        swatchName: "color-swatch",
        ariaLabel: "Lettering color",
      },
    });
    await wrapper.get('input[type="text"]').setValue("#fff");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["#fff"]);
    await wrapper.get('input[type="color"]').setValue("#4caf50");
    expect(wrapper.emitted("picker")).toBeTruthy();
    await wrapper.get('input[type="text"]').trigger("blur");
    expect(wrapper.emitted("blur")).toBeTruthy();
  });
});
