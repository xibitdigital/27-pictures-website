import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PageFilmstrip from "./PageFilmstrip.vue";

vi.mock("vue-router", () => ({
  RouterLink: { template: "<a><slot /></a>" },
}));

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
});
