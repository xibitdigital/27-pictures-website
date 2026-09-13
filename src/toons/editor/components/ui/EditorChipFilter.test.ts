import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EditorChipFilter from "./EditorChipFilter.vue";

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft", visibility: "draft" },
];

describe("EditorChipFilter", () => {
  it("renders a radiogroup with pressed state and visibility data attr", async () => {
    const wrapper = mount(EditorChipFilter, {
      props: {
        options: OPTIONS,
        modelValue: "all",
        role: "radiogroup",
        ariaLabel: "Visibility",
        namePrefix: "visibility-filter-",
      },
    });
    expect(wrapper.classes()).toContain("editor-visibility-filter");
    expect(wrapper.attributes("role")).toBe("radiogroup");
    const all = wrapper.get('button[name="visibility-filter-all"]');
    expect(all.attributes("aria-pressed")).toBe("true");
    expect(all.attributes("data-visibility")).toBeUndefined();
    const draft = wrapper.get('button[name="visibility-filter-draft"]');
    expect(draft.attributes("data-visibility")).toBe("draft");
    await draft.trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["draft"]);
  });

  it("uses tab roles when asked", () => {
    const wrapper = mount(EditorChipFilter, {
      props: {
        options: [{ value: "region", label: "Shapes" }],
        modelValue: "region",
        role: "tablist",
        ariaLabel: "Image kind",
        namePrefix: "gallery-tab-",
      },
    });
    const tab = wrapper.get('button[name="gallery-tab-region"]');
    expect(tab.attributes("role")).toBe("tab");
    expect(tab.attributes("aria-selected")).toBe("true");
  });
});
