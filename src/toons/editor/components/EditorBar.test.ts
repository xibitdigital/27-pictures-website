import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import EditorBar from "./EditorBar.vue";

vi.mock("vue-router", () => ({
  RouterLink: { template: "<a><slot /></a>" },
}));

describe("EditorBar", () => {
  it("stretches a title, session slot and All toons across the bar", () => {
    const wrapper = mount(EditorBar, {
      props: { title: "Toon" },
      global: { stubs: { EditorSession: { template: "<span>session</span>" } } },
    });
    expect(wrapper.get("h1").text()).toBe("Toon");
    expect(wrapper.text()).toContain("All toons");
    expect(wrapper.get("header").classes()).toContain("editor-bar");
    expect(wrapper.get("a.editor-btn--ghost svg").exists()).toBe(true);
  });

  it("keeps the account last, after All toons and the primary CTA", () => {
    const wrapper = mount(EditorBar, {
      props: { title: "Series" },
      slots: {
        actions: '<a class="editor-btn editor-btn--ghost">New toon</a>',
        primary: '<button class="editor-btn">Save</button>',
      },
      global: { stubs: { EditorSession: { template: '<button aria-label="Account menu"></button>' } } },
    });
    const labels = [...wrapper.get(".editor-bar-end").element.children].map((el) => {
      if ((el as HTMLElement).classList.contains("editor-bar-actions")) {
        return (el as HTMLElement).textContent?.replace(/\s+/g, " ").trim();
      }
      return (
        (el as HTMLElement).textContent?.replace(/\s+/g, " ").trim() || (el as HTMLElement).getAttribute("aria-label")
      );
    });
    expect(labels).toEqual(["New toon", "All toons", "Save", "Account menu"]);
  });

  it("hides All toons on the list home", () => {
    const wrapper = mount(EditorBar, {
      props: { title: "Toon editor", home: false },
      slots: { actions: "<button>New toon</button>" },
      global: { stubs: { EditorSession: true } },
    });
    expect(wrapper.text()).not.toContain("All toons");
    expect(wrapper.text()).toContain("New toon");
  });
});
