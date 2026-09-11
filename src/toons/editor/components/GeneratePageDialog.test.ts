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

  it("Clear empties the prompt for a Comfy series (no reference legend to put back)", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: true, generate, pages: [], busy: false, status: "" },
      attachTo: document.body,
    });
    await flushPromises();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Something happens here.";
    textarea.dispatchEvent(new Event("input"));
    await flushPromises();
    (document.querySelector('button[name="clear-prompt"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(textarea.value).toBe("");
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
          previousRegionId: null,
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
    (document.querySelector('button[aria-label="Page 1"]') as HTMLElement).click();
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
      [
        {
          prompt: "Erin walks in.",
          includePrevious: true,
          previousPageId: "p1",
          previousRegionId: null,
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
    (document.querySelector('button[aria-label="Page 2"]') as HTMLElement).click();
    await flushPromises();
    await wrapper.setProps({ open: false });
    await flushPromises();
    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(document.querySelector('button[aria-label="Page 2"]')?.classList).toContain("is-selected");
    wrapper.unmount();
  });

  it("lists a layout page's own shape images instead of its flattened composite", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: {
        open: false,
        generate: generateWithPrevious,
        pages: [
          { id: "p1", position: 0, fileUrl: "/p1.webp" },
          {
            id: "p2",
            position: 1,
            fileUrl: "/p2-flattened.webp",
            kind: "layout",
            regions: [
              { id: "r1", fileUrl: "/r1.webp" },
              { id: "r2", fileUrl: "/r2.webp" },
              { id: "r3", fileUrl: null },
            ],
          },
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
    expect(document.querySelector('button[aria-label="Page 2"]')).toBeNull();
    expect(document.querySelector('img[src="/p2-flattened.webp"]')).toBeNull();
    expect(document.querySelector('button[aria-label="Page 2 · shape 1"] img')?.getAttribute("src")).toBe("/r1.webp");
    expect(document.querySelector('button[aria-label="Page 2 · shape 2"] img')?.getAttribute("src")).toBe("/r2.webp");
    expect(document.querySelector('button[aria-label="Page 2 · shape 3"]')).toBeNull();

    (document.querySelector('button[aria-label="Page 2 · shape 1"]') as HTMLElement).click();
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
          previousPageId: null,
          previousRegionId: "r1",
          previousFile: null,
          count: 1,
          excludeAliases: [],
        },
      ],
    ]);
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
          previousRegionId: null,
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
          previousRegionId: null,
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

  it("numbers refs by the slots' own array order, not sheets-then-style-then-previous", async () => {
    const generateStyleFirst = {
      width: 1152,
      height: 1728,
      model: "seedream 5.0 pro",
      provider: "runware",
      flowKey: null,
      flowUrl: null,
      slots: [
        {
          alias: "style",
          label: "Image 1 — STYLE (ink technique only)",
          kind: "style",
          fileKey: "s.jpg",
          fileUrl: "/s.jpg",
        },
        { alias: "doll", label: "Image 2 - Doll", kind: "sheet", fileKey: "doll.jpg", fileUrl: "/doll.jpg" },
        { alias: "victim", label: "Image 3 — Victim", kind: "sheet", fileKey: "victim.jpg", fileUrl: "/victim.jpg" },
      ],
    };
    const wrapper = mount(GeneratePageDialog, {
      props: { open: false, generate: generateStyleFirst, pages: [], busy: false, status: "" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toContain(
      "# refs: Image 1 = style reference (ink technique/rendering only, not a character); Image 2 = Doll; Image 3 = Victim"
    );
    wrapper.unmount();
  });

  it("Clear wipes any typed scene text but immediately puts the reference legend back", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: false, generate: fluxGenerate, pages: [], busy: false, status: "" },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value += "A close-up on Erin's face.";
    textarea.dispatchEvent(new Event("input"));
    await flushPromises();
    (document.querySelector('button[name="clear-prompt"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(textarea.value).not.toContain("A close-up on Erin's face.");
    expect(textarea.value).toContain("# refs: Image 1 = Erin character sheet");
    expect(textarea.value).toContain("Using Image 1 for Erin character sheet");
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

describe("GeneratePageDialog Runware provider", () => {
  const runwareGenerate = {
    width: 1152,
    height: 1728,
    model: "bytedance:seedream@5.0-pro",
    provider: "runware",
    // Runware never reads the Comfy Save-API graph — no flowKey/flowUrl at all.
    flowKey: null,
    flowUrl: null,
    slots: [
      { alias: "erin", label: "Erin character sheet", kind: "sheet", fileKey: "erin.webp", fileUrl: "/erin.webp" },
    ],
  };

  it("does not require a Comfy flow to submit, and never shows the Comfy copy, when the series is set to Runware", async () => {
    const wrapper = mount(GeneratePageDialog, {
      props: { open: true, generate: runwareGenerate, pages: [], busy: false, status: "" },
      attachTo: document.body,
    });
    await flushPromises();
    expect(document.body.textContent).not.toContain("Upload a Comfy Save-API graph");
    expect(document.body.textContent).not.toContain("Comfy graph");
    expect(document.body.textContent).toContain("via Runware");
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "A close-up.";
    textarea.dispatchEvent(new Event("input"));
    await flushPromises();
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    wrapper.unmount();
  });
});
