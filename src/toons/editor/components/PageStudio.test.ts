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
          template: `<button type="button" name="pick-bubble" @click="$emit('select', bubbles[0].id)">pick</button>`,
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
