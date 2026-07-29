import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";

const loadPages = vi.fn().mockResolvedValue(undefined);
const isVertical = ref(false);
const pages = ref<string[]>(["assets/a.jpg", "assets/b.jpg", "assets/c.jpg"]);

vi.mock("../shared/useToonBook", () => ({
  useToonBook: () => ({
    getApi: () => ({
      updateView: vi.fn(),
      destroy: vi.fn(),
      goNext: vi.fn(),
      goPrev: vi.fn(),
    }),
  }),
}));

vi.mock("../shared/useViewMode", () => ({
  useViewMode: () => ({
    isVertical,
    pages,
    setVertical: vi.fn(),
    toggle: async () => {
      isVertical.value = !isVertical.value;
      document.body.classList.toggle("view-vertical", isVertical.value);
    },
    loadPages,
  }),
}));

vi.mock("../shared/loadManifest", () => ({
  createManifestLoader: () => async () => pages.value.slice(),
  loadManifest: async () => pages.value.slice(),
  pagesFromManifest: (m: { files?: string[] }) => m.files ?? [],
}));

import ErinApp from "./ErinApp.vue";

describe("ErinApp", () => {
  beforeEach(() => {
    isVertical.value = false;
    pages.value = ["assets/a.jpg", "assets/b.jpg", "assets/c.jpg"];
    loadPages.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
  });

  function mountErin() {
    return mount(ErinApp, {
      attachTo: document.body,
      global: {
        stubs: {
          FullscreenButton: { template: `<button type="button">FS</button>` },
          VerticalStrip: {
            props: ["pages", "altPrefix"],
            template: `<div class="erin-strip" :data-count="pages.length"></div>`,
          },
        },
      },
    });
  }

  it("renders back link and book chrome via shared shell", async () => {
    const wrapper = mountErin();
    await flushPromises();

    expect(wrapper.find(".toons-back").attributes("href")).toBe("/experiments/");
    expect(wrapper.find("#book").exists()).toBe(true);
    expect(wrapper.find("#btn-prev").exists()).toBe(true);
    expect(wrapper.find("#btn-next").exists()).toBe(true);
    expect(loadPages).toHaveBeenCalled();
  });

  it("toggles vertical scroll mode", async () => {
    const wrapper = mountErin();
    await flushPromises();

    expect(wrapper.find(".erin-strip").exists()).toBe(false);

    await wrapper
      .find('button[title="Switch to vertical scroll view"]')
      .trigger("click");
    await nextTick();

    expect(isVertical.value).toBe(true);
    expect(wrapper.find(".erin-strip").exists()).toBe(true);
    expect(wrapper.find(".erin-strip").attributes("data-count")).toBe("3");
    expect(wrapper.find('button[title="Switch to book view"]').classes()).toContain(
      "is-active"
    );

    await wrapper.find('button[title="Switch to book view"]').trigger("click");
    await nextTick();
    expect(isVertical.value).toBe(false);
    expect(wrapper.find(".erin-strip").exists()).toBe(false);
  });
});
