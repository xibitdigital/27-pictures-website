import { describe, expect, it } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import GeneratePageDialog from "./GeneratePageDialog.vue";
import { pickOption } from "../testSelect";

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
        pages: [],
        busy: false,
        status: "",
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
        pages: [],
        busy: false,
        status: "",
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

  it("leaves include-previous off by default and submits with no previous plate", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: false, generate: generateWithPrevious, pages: [], busy: false, status: "" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(document.querySelector('button[name="previous-page"]')).toBeNull();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Erin walks in.";
    textarea.dispatchEvent(new Event("input"));
    await flushPromises();
    (document.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await flushPromises();
    expect(wrapper.emitted("submit")).toEqual([
      [
        {
          prompt: "Erin walks in.",
          includePrevious: false,
          previousPageId: null,
          previousFile: null,
          count: 1,
          excludeAliases: [],
        },
      ],
    ]);
    wrapper.unmount();
  });

  it("lets the operator pick any existing plate as the previous reference", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: {
        open: false,
        generate: generateWithPrevious,
        pages: [
          { id: "p1", position: 0, fileUrl: "/p1.webp" },
          { id: "p2", position: 1, fileUrl: "/p2.webp" },
        ],
        busy: false,
        status: "",
      },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    (document.querySelector('[name="include-previous"]') as HTMLElement).click();
    await flushPromises();
    await pickOption("previous-page", "Page 1");
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Erin walks in.";
    textarea.dispatchEvent(new Event("input"));
    await flushPromises();
    (document.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await flushPromises();
    expect(wrapper.emitted("submit")).toEqual([
      [
        {
          prompt: "Erin walks in.",
          includePrevious: true,
          previousPageId: "p1",
          previousFile: null,
          count: 1,
          excludeAliases: [],
        },
      ],
    ]);
    wrapper.unmount();
  });

  it("remembers the last plate pick when the dialog is reopened", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: {
        open: false,
        generate: generateWithPrevious,
        pages: [
          { id: "p1", position: 0, fileUrl: "/p1.webp" },
          { id: "p2", position: 1, fileUrl: "/p2.webp" },
        ],
        busy: false,
        status: "",
      },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    (document.querySelector('[name="include-previous"]') as HTMLElement).click();
    await flushPromises();
    await pickOption("previous-page", "Page 2");
    await wrapper.setProps({ open: false });
    await flushPromises();
    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(document.querySelector('button[name="previous-page"]')?.textContent).toContain("Page 2");
    wrapper.unmount();
  });

  it("offers a file-pick button when the toon has no plates yet", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: false, generate: generateWithPrevious, pages: [], busy: false, status: "" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    (document.querySelector('[name="include-previous"]') as HTMLElement).click();
    await flushPromises();
    expect(document.querySelector('button[name="previous-page"]')).toBeNull();
    expect(document.querySelector('button[name="previous-file-pick"]')?.textContent).toContain(
      "Attach a previous plate"
    );
    wrapper.unmount();
  });

  it("lets a first-page generation proceed once a previous-plate file is attached", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: false, generate: generateWithPrevious, pages: [], busy: false, status: "" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    (document.querySelector('[name="include-previous"]') as HTMLElement).click();
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
      [
        {
          prompt: "Erin walks in.",
          includePrevious: true,
          previousPageId: null,
          previousFile: file,
          count: 1,
          excludeAliases: [],
        },
      ],
    ]);
    wrapper.unmount();
  });

  it("lets the operator pick how many plates to generate", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: false, generate: generateWithPrevious, pages: [], busy: false, status: "" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    await pickOption("generate-count", "3");
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Erin walks in.";
    textarea.dispatchEvent(new Event("input"));
    await flushPromises();
    (document.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await flushPromises();
    expect(wrapper.emitted("submit")).toEqual([
      [
        {
          prompt: "Erin walks in.",
          includePrevious: false,
          previousPageId: null,
          previousFile: null,
          count: 3,
          excludeAliases: [],
        },
      ],
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
      props: { open: true, generate: generateWithOptional, pages: [], busy: false, status: "" },
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

describe("GeneratePageDialog Flux provider", () => {
  const fluxGenerate = {
    width: 1152,
    height: 1728,
    model: "flux-2-pro",
    provider: "flux",
    // Flux never reads the Comfy Save-API graph — no flowKey/flowUrl at all.
    flowKey: null,
    flowUrl: null,
    slots: [
      { alias: "erin", label: "Erin character sheet", kind: "sheet", fileKey: "erin.webp", fileUrl: "/erin.webp" },
    ],
  };

  it("does not require a Comfy flow to submit when the series is set to Flux", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: true, generate: fluxGenerate, pages: [], busy: false, status: "" },
      attachTo: document.body,
    });
    await flushPromises();
    expect(document.body.textContent).not.toContain("Upload a Comfy Save-API graph");
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "A close-up.";
    textarea.dispatchEvent(new Event("input"));
    await flushPromises();
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    wrapper.unmount();
  });

  it("prefills the reference mapping but never a fixed style description", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: false, generate: fluxGenerate, pages: [], busy: false, status: "" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toContain("# model: flux-2-pro (BFL)");
    expect(textarea.value).toContain("# refs: Image 1 = Erin character sheet");
    expect(textarea.value).toContain("Using Image 1 for Erin character sheet");
    expect(textarea.value).not.toContain("horror manga");
    expect(textarea.value).not.toContain("Black and white");
    wrapper.unmount();
  });

  it("still shows the Comfy-flow warning for a Comfy series with no flow uploaded", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: {
        open: true,
        generate: { ...fluxGenerate, provider: "comfy" },
        pages: [],
        busy: false,
        status: "",
      },
      attachTo: document.body,
    });
    await flushPromises();
    expect(document.body.textContent).toContain("Upload a Comfy Save-API graph");
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    wrapper.unmount();
  });
});
