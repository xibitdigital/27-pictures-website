import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import VerticalStrip from "./VerticalStrip.vue";

describe("VerticalStrip", () => {
  it("renders one page-slot per file, each with its caption layer", async () => {
    const pages = ["assets/1.jpg", "assets/2.jpg", "assets/3.jpg"];
    const wrapper = mount(VerticalStrip, {
      props: { pages, altPrefix: "Jax" },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();

    const slots = wrapper.findAll(".vertical-page.page-slot");
    expect(slots).toHaveLength(3);
    expect(slots[0].attributes("data-page-num")).toBe("1");
    expect(slots[0].find("img").attributes("src")).toBe("assets/1.jpg");
    expect(slots[0].find("img").attributes("alt")).toContain("Jax");
    // PageCaptions renders per page (no-op without a captions store).
    expect(wrapper.findAllComponents({ name: "PageCaptions" })).toHaveLength(3);
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

  it("re-emits ready when pages change, without looping", async () => {
    const wrapper = mount(VerticalStrip, {
      props: { pages: ["a.jpg"] },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    expect(wrapper.emitted("ready")).toHaveLength(1);

    await wrapper.setProps({ pages: ["a.jpg", "b.jpg"] });
    await flushPromises();
    await nextTick();
    expect(wrapper.emitted("ready")).toHaveLength(2);
    expect(wrapper.findAll(".vertical-page")).toHaveLength(2);
    const slots = wrapper.emitted("ready")![1][0] as HTMLElement[];
    expect(slots.length).toBe(2);
  });
});
