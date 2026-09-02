import { describe, expect, it } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import GeneratePageDialog from "./GeneratePageDialog.vue";

const generate = {
  width: 1152,
  height: 1728,
  model: "seedream",
  flowKey: "flow.json",
  flowUrl: "/flow.json",
  slots: [{ alias: "erin", label: "Erin character sheet", kind: "sheet", fileUrl: "/erin.webp" }],
};

describe("GeneratePageDialog", () => {
  it("teleports a centered overlay onto body above the plate", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: {
        open: true,
        generate,
        hasPrevious: false,
        busy: false,
        status: "",
        error: "",
      },
      attachTo: document.body,
    });
    await flushPromises();
    const root = document.querySelector(".editor-dialog-root") as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.parentElement).toBe(document.body);
    expect(root.querySelector("h2")?.textContent).toBe("Generate page");
    wrapper.unmount();
  });

  it("stops pointer events on the overlay from bubbling out", async () => {
    const leaked: string[] = [];
    const onBody = (): void => {
      leaked.push("body");
    };
    document.body.addEventListener("pointerdown", onBody);
    const wrapper = mount(GeneratePageDialog, {
      props: {
        open: true,
        generate,
        hasPrevious: false,
        busy: false,
        status: "",
        error: "",
      },
      attachTo: document.body,
    });
    await flushPromises();
    const panel = document.querySelector(".editor-dialog") as HTMLElement;
    panel.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(leaked).toEqual([]);
    wrapper.unmount();
    document.body.removeEventListener("pointerdown", onBody);
  });
});
