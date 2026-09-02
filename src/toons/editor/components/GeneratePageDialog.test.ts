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

describe("GeneratePageDialog previous-plate override", () => {
  const generateWithPrevious = {
    width: 1152,
    height: 1728,
    model: "seedream",
    flowKey: "flow.json",
    flowUrl: "/flow.json",
    slots: [
      { alias: "erin", label: "Erin character sheet", kind: "sheet", fileKey: "erin.webp", fileUrl: "/erin.webp" },
      { alias: "previous", label: "Image 8 — previous", kind: "previous", fileKey: null, fileUrl: null },
    ],
  };

  it("submits with previousFile: null when nothing is attached", async () => {
    // Mount closed then open it, same as real usage — the dialog syncs
    // includePrevious to hasPrevious in a watcher that only fires on that
    // false->true transition, not on an already-open initial mount.
    const wrapper = mount(GeneratePageDialog, {
      props: { open: false, generate: generateWithPrevious, hasPrevious: false, busy: false, status: "", error: "" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Erin walks in.";
    textarea.dispatchEvent(new Event("input"));
    await flushPromises();
    (document.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await flushPromises();
    expect(wrapper.emitted("submit")).toEqual([
      [{ prompt: "Erin walks in.", includePrevious: false, previousFile: null }],
    ]);
    wrapper.unmount();
  });

  it("lets a first-page generation proceed once a previous-plate file is attached", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: false, generate: generateWithPrevious, hasPrevious: false, busy: false, status: "", error: "" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Erin walks in.";
    textarea.dispatchEvent(new Event("input"));
    const fileInput = document.querySelector('input[name="previous-file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], "ref.webp", { type: "image/webp" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fileInput.dispatchEvent(new Event("change"));
    await flushPromises();
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    (document.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await flushPromises();
    expect(wrapper.emitted("submit")).toEqual([
      [{ prompt: "Erin walks in.", includePrevious: false, previousFile: file }],
    ]);
    wrapper.unmount();
  });
});
