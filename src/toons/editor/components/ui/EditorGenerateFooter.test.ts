import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EditorGenerateFooter from "./EditorGenerateFooter.vue";

describe("EditorGenerateFooter", () => {
  it("shows the idle submit label and no status line when not busy", () => {
    const wrapper = mount(EditorGenerateFooter, {
      props: { busy: false, status: "", defaultStatus: "Generating page…", submitLabel: "Generate 3", canSubmit: true },
    });
    expect(wrapper.find(".editor-generate-status").exists()).toBe(false);
    expect(wrapper.get('button[type="submit"]').text()).toBe("Generate 3");
    expect((wrapper.get('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the live status (or the default) and 'Generating…' while busy, disables both buttons appropriately", () => {
    const wrapper = mount(EditorGenerateFooter, {
      props: { busy: true, status: "", defaultStatus: "Generating page…", submitLabel: "Generate", canSubmit: true },
    });
    expect(wrapper.get(".editor-generate-status").text()).toBe("Generating page…");
    expect(wrapper.get('button[type="submit"]').text()).toContain("Generating…");
    expect((wrapper.get('button[type="button"]').element as HTMLButtonElement).disabled).toBe(true);
  });

  it("prefers the live status over the default once one arrives", () => {
    const wrapper = mount(EditorGenerateFooter, {
      props: {
        busy: true,
        status: "Waiting in the queue… · 0:04",
        defaultStatus: "Generating page…",
        submitLabel: "Generate",
        canSubmit: true,
      },
    });
    expect(wrapper.get(".editor-generate-status").text()).toBe("Waiting in the queue… · 0:04");
  });

  it("emits cancel from the ghost button", async () => {
    const wrapper = mount(EditorGenerateFooter, {
      props: { busy: false, status: "", defaultStatus: "Generating…", submitLabel: "Generate", canSubmit: true },
    });
    await wrapper.get('button[type="button"]').trigger("click");
    expect(wrapper.emitted("cancel")).toBeTruthy();
  });
});
