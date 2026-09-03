import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ConfirmDialog from "./ConfirmDialog.vue";

describe("ConfirmDialog", () => {
  it("teleports onto body with the given title and message, and emits confirm/cancel", async () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, title: "Delete page?", message: "This can't be undone.", confirmLabel: "Delete" },
      attachTo: document.body,
    });
    await flushPromises();
    const dialog = document.querySelector(".editor-dialog") as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.querySelector("h2")?.textContent).toBe("Delete page?");
    expect(dialog.textContent).toContain("This can't be undone.");

    (document.querySelector('button[type="button"]:not(.editor-btn--ghost)') as HTMLButtonElement).click();
    expect(wrapper.emitted("confirm")).toHaveLength(1);

    (document.querySelector(".editor-btn--ghost") as HTMLButtonElement).click();
    expect(wrapper.emitted("cancel")).toHaveLength(1);
    wrapper.unmount();
  });

  it("emits cancel on Escape", async () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, message: "Sure?" },
      attachTo: document.body,
    });
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushPromises();
    expect(wrapper.emitted("cancel")).toHaveLength(1);
    wrapper.unmount();
  });
});
