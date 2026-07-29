import { describe, it, expect, vi } from "vitest";
import { nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import VerticalStrip from "./VerticalStrip.vue";

describe("VerticalStrip", () => {
  it("renders one page-slot per file", async () => {
    const pages = ["assets/1.jpg", "assets/2.jpg", "assets/3.jpg"];
    const onPagePaint = vi.fn();
    const wrapper = mount(VerticalStrip, {
      props: {
        pages,
        altPrefix: "Jax",
        onPagePaint,
      },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();

    const slots = wrapper.findAll(".vertical-page.page-slot");
    expect(slots).toHaveLength(3);
    expect(slots[0].attributes("data-page-num")).toBe("1");
    expect(slots[0].find("img").attributes("src")).toBe("assets/1.jpg");
    expect(slots[0].find("img").attributes("alt")).toContain("Jax");
    expect(onPagePaint).toHaveBeenCalledTimes(3);
    expect(onPagePaint.mock.calls[0][1]).toBe(1);
  });

  it("emits ready with slot elements", async () => {
    const wrapper = mount(VerticalStrip, {
      props: { pages: ["a.jpg", "b.jpg"] },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    const ready = wrapper.emitted("ready");
    expect(ready).toBeTruthy();
    const slots = ready![0][0] as HTMLElement[];
    expect(slots.length).toBe(2);
    expect(slots[0].dataset.pageNum).toBe("1");
  });

  it("re-paints when pages change without looping", async () => {
    const onPagePaint = vi.fn();
    const wrapper = mount(VerticalStrip, {
      props: { pages: ["a.jpg"], onPagePaint },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    const firstCalls = onPagePaint.mock.calls.length;
    expect(firstCalls).toBe(1);

    await wrapper.setProps({ pages: ["a.jpg", "b.jpg"] });
    await flushPromises();
    await nextTick();
    expect(onPagePaint.mock.calls.length).toBe(firstCalls + 2);
    expect(wrapper.findAll(".vertical-page")).toHaveLength(2);
  });
});
