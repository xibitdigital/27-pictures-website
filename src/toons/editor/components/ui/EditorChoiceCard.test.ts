import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EditorChoiceCard from "./EditorChoiceCard.vue";

describe("EditorChoiceCard", () => {
  it("renders a button with the shared choice-card class and forwards attrs/click", async () => {
    const wrapper = mount(EditorChoiceCard, {
      attrs: { name: "add-page-upload", title: "Upload" },
      slots: { default: "Upload" },
    });
    const button = wrapper.get("button");
    expect(button.classes()).toContain("editor-add-page-choice");
    expect(button.attributes("name")).toBe("add-page-upload");
    expect(button.attributes("type")).toBe("button");
    await button.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });
});
