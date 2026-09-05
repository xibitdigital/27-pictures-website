import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import ShareButton from "./ShareButton.vue";

describe("ShareButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("copies the current URL when the system share sheet is missing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const wrapper = mount(ShareButton);
    expect(wrapper.get("button").attributes("aria-label")).toBe("Share");
    await wrapper.get('button[name="share-toon"]').trigger("click");
    await nextTick();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(wrapper.get("button").attributes("aria-label")).toBe("Link copied");
    wrapper.unmount();
  });

  it("uses the system share sheet when the browser has one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    const wrapper = mount(ShareButton);
    await wrapper.get('button[name="share-toon"]').trigger("click");
    await nextTick();
    expect(share).toHaveBeenCalledWith({ title: document.title, url: window.location.href });
    expect(writeText).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
