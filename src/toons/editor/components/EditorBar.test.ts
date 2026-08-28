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
