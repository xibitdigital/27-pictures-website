import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EditorVisibilityBadge from "./EditorVisibilityBadge.vue";

describe("EditorVisibilityBadge", () => {
  it("sets the shared class and data-visibility from props", () => {
    const wrapper = mount(EditorVisibilityBadge, { props: { label: "Draft", visibility: "draft" } });
    expect(wrapper.classes()).toContain("editor-visibility-badge");
    expect(wrapper.attributes("data-visibility")).toBe("draft");
    expect(wrapper.text()).toBe("Draft");
  });

  it("omits data-visibility when none is passed", () => {
    const wrapper = mount(EditorVisibilityBadge, { props: { label: "Draft" } });
    expect(wrapper.attributes("data-visibility")).toBeUndefined();
  });
});
