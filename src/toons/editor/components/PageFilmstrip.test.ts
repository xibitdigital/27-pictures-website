import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PageFilmstrip from "./PageFilmstrip.vue";

vi.mock("vue-router", () => ({
  RouterLink: { template: "<a><slot /></a>" },
}));

const onePage = [{ id: "p1", position: 0, fileUrl: "/p1.webp", fileKey: "p1", width: 800, height: 1424, bubbles: [] }];

describe("PageFilmstrip", () => {
  it("emits generate from the Generate control", async () => {
    const wrapper = mount(PageFilmstrip, {
      props: { toonId: "t1", pages: [], activeId: null, canGenerate: true },
    });
    await wrapper.get('button[name="add-page-generate"]').trigger("click");
    expect(wrapper.emitted("generate")).toHaveLength(1);
  });

  it("still offers Generate when the series has no flow yet", async () => {
    const wrapper = mount(PageFilmstrip, {
      props: { toonId: "t1", pages: [], activeId: null, canGenerate: false },
    });
    const btn = wrapper.get('button[name="add-page-generate"]');
    expect(btn.attributes("disabled")).toBeUndefined();
    await btn.trigger("click");
    expect(wrapper.emitted("generate")).toHaveLength(1);
  });

  it("puts Add page after the existing thumbs", () => {
    const wrapper = mount(PageFilmstrip, {
      props: {
        toonId: "t1",
        pages: [
          {
            id: "p1",
            position: 0,
            fileUrl: "/p1.webp",
            fileKey: "p1",
            width: 800,
            height: 1424,
            bubbles: [],
          },
          {
            id: "p2",
            position: 1,
            fileUrl: "/p2.webp",
            fileKey: "p2",
            width: 800,
            height: 1424,
            bubbles: [],
          },
        ],
        activeId: "p1",
      },
    });
    const kids = [...wrapper.get("nav").element.children].map((el) => el.className);
    expect(kids.at(-1)).toContain("editor-filmstrip-add-wrap");
    expect(kids.slice(0, -1).every((c) => c.includes("editor-thumb"))).toBe(true);
  });

  it("shows a confirm dialog and emits remove once confirmed", async () => {
    const wrapper = mount(PageFilmstrip, {
      props: { toonId: "t1", pages: onePage, activeId: "p1" },
      attachTo: document.body,
    });
    await wrapper.get(".editor-thumb-remove").trigger("click");
    await flushPromises();
    const dialog = document.querySelector(".editor-dialog") as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain("Delete page 1?");
    const confirmBtn = [...dialog.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Delete");
    confirmBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(wrapper.emitted("remove")).toEqual([["p1"]]);
    wrapper.unmount();
  });

  it("does not emit remove when the confirm dialog is cancelled", async () => {
    const wrapper = mount(PageFilmstrip, {
      props: { toonId: "t1", pages: onePage, activeId: "p1" },
      attachTo: document.body,
    });
    await wrapper.get(".editor-thumb-remove").trigger("click");
    await flushPromises();
    const dialog = document.querySelector(".editor-dialog") as HTMLElement;
    const cancelBtn = [...dialog.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Cancel");
    cancelBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(wrapper.emitted("remove")).toBeUndefined();
    expect(document.querySelector(".editor-dialog-root")).toBeFalsy();
    wrapper.unmount();
  });

  it("emits replace with the chosen file for a thumb", async () => {
    const wrapper = mount(PageFilmstrip, {
      props: { toonId: "t1", pages: onePage, activeId: "p1" },
    });
    const input = wrapper.get(".editor-thumb-replace input");
    const file = new File([new Uint8Array([1, 2, 3])], "plate.webp", { type: "image/webp" });
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");
    expect(wrapper.emitted("replace")).toEqual([["p1", file]]);
  });
});
