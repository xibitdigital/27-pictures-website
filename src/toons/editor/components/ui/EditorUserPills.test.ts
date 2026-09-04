import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EditorUserPills from "./EditorUserPills.vue";
import type { EditorUser } from "../../types";

const roster: EditorUser[] = [
  { id: "e1", email: "eve@example.com", username: "eve", role: "editor" },
  { id: "e2", email: "sam@example.com", username: "sam", role: "editor" },
];

describe("EditorUserPills", () => {
  it("shows selected users as pills and adds from the filtered list", async () => {
    const wrapper = mount(EditorUserPills, {
      props: { modelValue: ["e1"], options: roster },
      attachTo: document.body,
    });
    expect(wrapper.text()).toContain("eve");
    expect(wrapper.find('[data-editor-option="e1"]').exists()).toBe(false);
    await wrapper.get('input[name="editor-search"]').setValue("sam");
    await wrapper.get('input[name="editor-search"]').trigger("focus");
    expect(wrapper.get('[data-editor-option="e2"]').text()).toContain("sam@example.com");
    await wrapper.get('[data-editor-option="e2"]').trigger("mousedown");
    expect(wrapper.emitted("update:modelValue")?.[0][0]).toEqual(["e1", "e2"]);
    wrapper.unmount();
  });

  it("removes a pill", async () => {
    const wrapper = mount(EditorUserPills, {
      props: { modelValue: ["e1", "e2"], options: roster },
    });
    await wrapper.get('button[name="editor-remove-e1"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0][0]).toEqual(["e2"]);
  });
});
