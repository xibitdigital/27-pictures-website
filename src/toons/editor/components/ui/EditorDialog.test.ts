import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import EditorDialog from "./EditorDialog.vue";

describe("EditorDialog", () => {
  // Reka's DialogContent teleports into document.body, outside the mounted wrapper's own
  // element — query the document directly, same pattern GeneratePageDialog.test.ts already uses.

  it("shows a close (X) button by default and closing it emits update:open false", async () => {
    const wrapper = mount(EditorDialog, {
      props: { open: false, title: "Add page" },
      slots: { default: "<p>body</p>" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const close = document.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    close.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
    wrapper.unmount();
  });

  it("hides the close button when hideClose is set (the two Generate dialogs)", async () => {
    const wrapper = mount(EditorDialog, {
      props: { open: false, title: "Generate page", hideClose: true },
      slots: { default: "<p>body</p>" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(document.querySelector('button[aria-label="Close"]')).toBeNull();
    wrapper.unmount();
  });
});
