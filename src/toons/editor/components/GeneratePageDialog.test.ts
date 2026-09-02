import { describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import GeneratePageDialog from "./GeneratePageDialog.vue";

describe("GeneratePageDialog", () => {
  it("opens as a modal so the heading is not clipped", async () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    const wrapper = mount(GeneratePageDialog, {
      props: {
        open: true,
        generate: {
          width: 1152,
          height: 1728,
          model: "seedream",
          flowKey: "flow.json",
          flowUrl: "/flow.json",
          slots: [{ alias: "erin", label: "Erin character sheet", kind: "sheet", fileUrl: "/erin.webp" }],
        },
        hasPrevious: false,
        busy: false,
        status: "",
        error: "",
      },
      attachTo: document.body,
    });
    await flushPromises();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(wrapper.get("h2").text()).toBe("Generate page");
    expect(wrapper.get('textarea[name="generate-prompt"]').element).toBeTruthy();
    wrapper.unmount();
  });
});
