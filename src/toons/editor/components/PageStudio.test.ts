import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import PageStudio from "./PageStudio.vue";
import * as api from "../api";
import type { BubbleRecord, ToonRecord } from "../types";

const route = { params: { id: "t1", pageId: "p1" } as Record<string, string> };
const replace = vi.fn();

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn(), replace }),
  RouterLink: { template: "<a><slot /></a>" },
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
}));

const bubble: BubbleRecord = {
  id: "b1",
  x: 0.5,
  y: 0.2,
  variant: "bubble",
  tail: "bottom-left",
  size: 22,
  angle: null,
  textEn: "Hi",
  sort: 0,
};

function sampleToon(): ToonRecord {
  return {
    id: "t1",
    slug: "demo",
    title: "Demo",
    subtitle: "",
    description: "",
    coverKey: null,
    coverUrl: null,
    designWidth: 800,
    designHeight: 1424,
    status: "draft",
    pages: [
      {
        id: "p1",
        position: 0,
        fileKey: "p1",
        fileUrl: "/p1.webp",
        width: 800,
        height: 1424,
        bubbles: [{ ...bubble }],
      },
    ],
  };
}

function mountStudio() {
  return mount(PageStudio, {
    attachTo: document.body,
    global: {
      stubs: {
        EditorBar: true,
        PageFilmstrip: true,
        GeneratePageDialog: true,
        PlateCanvas: {
          props: ["bubbles"],
          template: `<div>
            <button type="button" name="pick-bubble" @click="$emit('select', bubbles[0].id)">pick</button>
            <button type="button" name="remove-bubble" @click="$emit('remove', bubbles[0].id)">trash</button>
          </div>`,
        },
      },
    },
  });
}

async function selectBubble(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('button[name="pick-bubble"]').trigger("click");
}

describe("PageStudio bubble delete", () => {
  beforeEach(() => {
    route.params = { id: "t1", pageId: "p1" };
    replace.mockReset();
    vi.spyOn(api, "getToon").mockResolvedValue(sampleToon());
    vi.spyOn(api, "deleteBubble").mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("asks before deleting a focused bubble with Delete, OK already focused", async () => {
    const wrapper = mountStudio();
    await flushPromises();
    await selectBubble(wrapper);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    await flushPromises();

    const dialog = document.querySelector(".editor-dialog") as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain("Delete this bubble?");
    const ok = document.querySelector('button[name="confirm"]') as HTMLButtonElement;
    expect(ok.textContent?.trim()).toBe("OK");
    expect(document.activeElement).toBe(ok);

    ok.click();
    await flushPromises();
    expect(api.deleteBubble).toHaveBeenCalledWith("b1");
    wrapper.unmount();
  });

  it("does not delete when the confirm is cancelled", async () => {
    const wrapper = mountStudio();
    await flushPromises();
    await selectBubble(wrapper);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    await flushPromises();

    const cancel = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Cancel");
    cancel!.click();
    await flushPromises();
    expect(api.deleteBubble).not.toHaveBeenCalled();
    expect(document.querySelector(".editor-dialog-root")).toBeFalsy();
    wrapper.unmount();
  });

  it("does not steal Backspace while typing a caption", async () => {
    const wrapper = mountStudio();
    await flushPromises();
    await selectBubble(wrapper);
    const textarea = wrapper.get("textarea").element as HTMLTextAreaElement;
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    await flushPromises();
    expect(document.querySelector(".editor-dialog")).toBeFalsy();
    expect(api.deleteBubble).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("reorders bubbles so auto-read array order changes", async () => {
    const toon = sampleToon();
    toon.pages[0].bubbles = [
      { ...bubble, id: "b1", sort: 0, textEn: "First" },
      { ...bubble, id: "b2", sort: 1, textEn: "Second" },
    ];
    vi.mocked(api.getToon).mockResolvedValue(toon);
    const wrapper = mountStudio();
    await flushPromises();
    await selectBubble(wrapper);
    expect(wrapper.text()).toContain("1 of 2");
    await wrapper.get('button[name="order-later"]').trigger("click");
    expect(wrapper.text()).toContain("2 of 2");
    const ids = toon.pages[0].bubbles.map((b) => b.id);
    expect(ids).toEqual(["b2", "b1"]);
    wrapper.unmount();
  });

  it("shows the mode switch only for a layout-kind page, and toggles Layout/Bubbles", async () => {
    const toon = sampleToon();
    toon.pages[0].kind = "layout";
    toon.pages[0].regions = [];
    vi.mocked(api.getToon).mockResolvedValue(toon);
    const wrapper = mountStudio();
    await flushPromises();
    expect(document.querySelector('[name="mode-layout"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[name="mode-bubbles"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(wrapper.find(".editor-inspector h2").text()).toBe("Layout");

    (document.querySelector('[name="mode-bubbles"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(document.querySelector('[name="mode-bubbles"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(wrapper.find(".editor-inspector h2").text()).toBe("Bubble");
    wrapper.unmount();
  });

  it("hides the mode switch entirely for a plain plate page", async () => {
    const wrapper = mountStudio();
    await flushPromises();
    expect(document.querySelector('[name="mode-layout"]')).toBeNull();
    wrapper.unmount();
  });

  it("confirms from the canvas trash icon without needing the bubble already selected", async () => {
    const wrapper = mountStudio();
    await flushPromises();
    // No selectBubble() first — the trash icon on an unselected bubble must select it too.
    await wrapper.get('button[name="remove-bubble"]').trigger("click");
    await flushPromises();
    expect(document.querySelector(".editor-dialog")?.textContent).toContain("Delete this bubble?");
    const ok = document.querySelector('button[name="confirm"]') as HTMLButtonElement;
    ok.click();
    await flushPromises();
    expect(api.deleteBubble).toHaveBeenCalledWith("b1");
    wrapper.unmount();
  });

  it("confirms from the inspector Delete bubble button too", async () => {
    const wrapper = mountStudio();
    await flushPromises();
    await selectBubble(wrapper);
    await wrapper.get('button[name="delete"]').trigger("click");
    await flushPromises();
    expect(document.querySelector(".editor-dialog")?.textContent).toContain("Delete this bubble?");
    expect(api.deleteBubble).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});

describe("PageStudio unsaved layout", () => {
  const region = {
    id: "r1",
    shapeType: "rect" as const,
    geometry: { kind: "rect" as const, x: 0.1, y: 0.1, w: 0.4, h: 0.4 },
    fileKey: null,
    fileUrl: null,
    fileWidth: null,
    fileHeight: null,
    imageOffsetX: 0.5,
    imageOffsetY: 0.5,
    imageScale: 1,
    borderColor: null,
    borderWidth: 0,
    borderStyle: "solid" as const,
    sort: 0,
  };

  function layoutToon(): ToonRecord {
    const next = sampleToon();
    next.pages[0].kind = "layout";
    next.pages[0].regions = [{ ...region }];
    return next;
  }

  function mountLayoutStudio() {
    return mount(PageStudio, {
      attachTo: document.body,
      global: {
        stubs: {
          EditorBar: true,
          GeneratePageDialog: true,
          PageFilmstrip: {
            template: `<button type="button" name="add-page" @click="$emit('layout')">add</button>`,
          },
          PlateCanvas: {
            props: ["bubbles"],
            template: `<button type="button" name="dirty-layout" @click="$emit('persist-region-geometry', 'r1', { kind: 'rect', x: 0.2, y: 0.2, w: 0.3, h: 0.3 })">dirty</button>`,
          },
        },
      },
    });
  }

  beforeEach(() => {
    route.params = { id: "t1", pageId: "p1" };
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb) {
      cb(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    });
    vi.spyOn(api, "getToon").mockResolvedValue(layoutToon());
    vi.spyOn(api, "patchRegion").mockResolvedValue({
      ...region,
      geometry: { kind: "rect", x: 0.2, y: 0.2, w: 0.3, h: 0.3 },
    });
    vi.spyOn(api, "uploadPage").mockResolvedValue(layoutToon());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("blocks adding a page until Stay or Discard", async () => {
    const wrapper = mountLayoutStudio();
    await flushPromises();
    await wrapper.get('button[name="dirty-layout"]').trigger("click");
    await flushPromises();
    await wrapper.get('button[name="add-page"]').trigger("click");
    await flushPromises();
    expect(document.querySelector(".editor-dialog")?.textContent).toContain("Save this page's layout first");
    expect(api.uploadPage).not.toHaveBeenCalled();

    const stay = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Stay");
    stay?.click();
    await flushPromises();
    expect(api.uploadPage).not.toHaveBeenCalled();
    expect(document.querySelector(".editor-dialog-root")).toBeFalsy();
    wrapper.unmount();
  });

  it("discards and continues when Discard is chosen", async () => {
    const wrapper = mountLayoutStudio();
    await flushPromises();
    await wrapper.get('button[name="dirty-layout"]').trigger("click");
    await flushPromises();
    await wrapper.get('button[name="add-page"]').trigger("click");
    await flushPromises();
    const discard = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Discard");
    discard?.click();
    await flushPromises();
    expect(api.uploadPage).toHaveBeenCalled();
    wrapper.unmount();
  });
});
