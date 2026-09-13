import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EditorIconButton from "./EditorIconButton.vue";

describe("EditorIconButton", () => {
  it("defaults to the ghost icon-btn class, not danger", () => {
    const wrapper = mount(EditorIconButton, { slots: { default: "×" } });
    const el = wrapper.get("button");
    expect(el.classes()).toContain("editor-icon-btn");
    expect(el.classes()).not.toContain("editor-icon-btn--danger");
    expect(el.attributes("type")).toBe("button");
  });

  it("adds editor-icon-btn--danger for variant=danger", () => {
    const wrapper = mount(EditorIconButton, { props: { variant: "danger" }, slots: { default: "×" } });
    expect(wrapper.get("button").classes()).toContain("editor-icon-btn--danger");
  });

  it("forwards name, disabled, extra class, and click", async () => {
    const wrapper = mount(EditorIconButton, {
      props: { disabled: true },
      attrs: { name: "audio-upload", class: "editor-translate-btn", title: "Upload" },
      slots: { default: "↑" },
    });
    const el = wrapper.get("button");
    expect(el.attributes("name")).toBe("audio-upload");
    expect(el.attributes("disabled")).toBeDefined();
    expect(el.attributes("title")).toBe("Upload");
    expect(el.classes()).toContain("editor-translate-btn");
  });

  it("emits click when enabled", async () => {
    const wrapper = mount(EditorIconButton, { slots: { default: "↑" } });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });
});
