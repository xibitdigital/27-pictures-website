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

  it("does not close when clicking inside the dialog panel (only outside clicks dismiss)", async () => {
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
    await flushPromises();
    expect(wrapper.emitted("close")).toBeUndefined();
    wrapper.unmount();
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

describe("GeneratePageDialog optional sheet slots", () => {
  const generateWithOptional = {
    width: 1152,
    height: 1728,
    model: "seedream",
    flowKey: "flow.json",
    flowUrl: "/flow.json",
    slots: [
      { alias: "victim", label: "Image 3 — Victim", kind: "sheet", fileKey: "victim.webp", fileUrl: "/victim.webp" },
      { alias: "venue", label: "Image 4 — Venue", kind: "sheet", optional: true, fileKey: null, fileUrl: null },
    ],
  };

  it("does not block submit on a missing optional sheet, and shows it as skipped", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: true, generate: generateWithOptional, hasPrevious: false, busy: false, status: "", error: "" },
      attachTo: document.body,
    });
    await flushPromises();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "A beat.";
    textarea.dispatchEvent(new Event("input"));
    await flushPromises();
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    const rows = [...document.querySelectorAll(".editor-dialog-slots li")].map((li) => li.textContent);
    expect(rows.some((t) => t?.includes("optional") && t?.includes("skipped"))).toBe(true);
    wrapper.unmount();
  });
});
