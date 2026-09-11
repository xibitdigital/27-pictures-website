import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import AssetGalleryDialog from "./AssetGalleryDialog.vue";
import * as api from "../api";

describe("AssetGalleryDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the Shapes tab, loads region assets, and emits pick with the chosen one", async () => {
    const listSpy = vi.spyOn(api, "listToonAssets").mockResolvedValue([
      { id: "a1", fileKey: "editor/demo/assets/a.webp", url: "/a.webp", width: 800, height: 1424, createdAt: "t1" },
      { id: "a2", fileKey: "editor/demo/assets/b.webp", url: "/b.webp", width: 800, height: 1424, createdAt: "t2" },
    ]);
    const wrapper = mount(AssetGalleryDialog, {
      props: { open: true, toonId: "t1" },
      attachTo: document.body,
    });
    await flushPromises();
    expect(listSpy).toHaveBeenCalledWith("t1", "region");
    expect(document.querySelector('button[name="gallery-tab-region"]')?.getAttribute("aria-selected")).toBe("true");
    const buttons = document.querySelectorAll(".editor-asset-gallery .editor-plate-picker-item");
    expect(buttons).toHaveLength(2);
    (buttons[1] as HTMLElement).click();
    expect(wrapper.emitted("pick")?.[0]).toEqual([
      { id: "a2", fileKey: "editor/demo/assets/b.webp", url: "/b.webp", width: 800, height: 1424, createdAt: "t2" },
    ]);
    wrapper.unmount();
  });

  it("switches to the Pages tab and reloads with that source", async () => {
    const listSpy = vi.spyOn(api, "listToonAssets").mockResolvedValue([]);
    const wrapper = mount(AssetGalleryDialog, {
      props: { open: true, toonId: "t1" },
      attachTo: document.body,
    });
    await flushPromises();
    (document.querySelector('button[name="gallery-tab-page"]') as HTMLElement).click();
    await flushPromises();
    expect(listSpy).toHaveBeenLastCalledWith("t1", "page");
    wrapper.unmount();
  });

  it("shows an empty state instead of a blank grid", async () => {
    vi.spyOn(api, "listToonAssets").mockResolvedValue([]);
    const wrapper = mount(AssetGalleryDialog, {
      props: { open: true, toonId: "t1" },
      attachTo: document.body,
    });
    await flushPromises();
    expect(document.body.textContent).toContain("No images yet");
    wrapper.unmount();
  });
});
