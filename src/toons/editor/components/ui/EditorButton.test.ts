import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import EditorButton from "./EditorButton.vue";

vi.mock("vue-router", () => ({
  RouterLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
}));

describe("EditorButton", () => {
  it("defaults to variant=primary, type=button, no ghost/danger class", () => {
    const wrapper = mount(EditorButton, { slots: { default: "Save" } });
    const el = wrapper.get("button");
    expect(el.classes()).toContain("editor-btn");
    expect(el.classes()).not.toContain("editor-btn--ghost");
    expect(el.classes()).not.toContain("editor-btn--danger");
    expect(el.attributes("type")).toBe("button");
  });

  it("adds editor-btn--ghost for variant=ghost", () => {
    const wrapper = mount(EditorButton, { props: { variant: "ghost" }, slots: { default: "Cancel" } });
    expect(wrapper.get("button").classes()).toContain("editor-btn--ghost");
  });

  it("adds editor-btn--danger for variant=danger", () => {
    const wrapper = mount(EditorButton, { props: { variant: "danger" }, slots: { default: "Delete" } });
    expect(wrapper.get("button").classes()).toContain("editor-btn--danger");
  });

  it("renders type=submit when asked, for a form's native Enter-to-submit", () => {
    const wrapper = mount(EditorButton, { props: { type: "submit" }, slots: { default: "Save" } });
    expect(wrapper.get("button").attributes("type")).toBe("submit");
  });

  it("renders a RouterLink instead of a button when `to` is set", () => {
    const wrapper = mount(EditorButton, { props: { to: "/series/new" }, slots: { default: "New series" } });
    expect(wrapper.find("button").exists()).toBe(false);
    const link = wrapper.get("a");
    expect(link.attributes("href")).toBe("/series/new");
    expect(link.classes()).toContain("editor-btn");
  });

  it("merges a caller-passed class alongside its own variant classes", () => {
    const wrapper = mount(EditorButton, {
      props: { variant: "ghost" },
      attrs: { class: "editor-field-btn" },
      slots: { default: "Replace image" },
    });
    const classes = wrapper.get("button").classes();
    expect(classes).toContain("editor-btn");
    expect(classes).toContain("editor-btn--ghost");
    expect(classes).toContain("editor-field-btn");
  });

  it("exposes focus() on the underlying <button>, for a caller that used to focus a raw element", async () => {
    const wrapper = mount(EditorButton, { attachTo: document.body, slots: { default: "OK" } });
    (wrapper.vm as unknown as { focus: () => void }).focus();
    expect(document.activeElement).toBe(wrapper.get("button").element);
    wrapper.unmount();
  });
});
