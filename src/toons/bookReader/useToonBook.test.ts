import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { useToonBook } from "./useToonBook";
import BookSurface from "./BookSurface.vue";
import {
  stubReaderMatchMedia,
  stubImagePreload,
  FOUR_PAGES,
} from "@/test/bookFixture";

function mountBook() {
  let api: ReturnType<typeof useToonBook> | undefined;

  const Comp = defineComponent({
    setup() {
      api = useToonBook({ pages: FOUR_PAGES, altPrefix: "Jax" });
      return () =>
        h(BookSurface, {
          engine: api!.engine,
          altPrefix: "Jax",
        });
    },
  });

  const wrapper = mount(Comp, { attachTo: document.body });
  return {
    wrapper,
    getApi: () => api!.getApi(),
    getEngine: () => api!.engine,
  };
}

describe("useToonBook", () => {
  beforeEach(() => {
    stubReaderMatchMedia("reduce-motion");
    stubImagePreload();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("initializes the reader after mount", async () => {
    const { getApi, wrapper } = mountBook();
    await flushPromises();
    await vi.waitFor(() => {
      expect(getApi()).toBeDefined();
      expect(getApi()!.getPages().length).toBe(4);
    });
    expect(wrapper.find(".front-cover-instructions").exists()).toBe(true);
  });

  it("destroys the reader on unmount", async () => {
    const { wrapper, getApi } = mountBook();
    await vi.waitFor(() => expect(getApi()?.getPages().length).toBe(4));
    const api = getApi()!;
    const destroySpy = vi.spyOn(api, "destroy");
    wrapper.unmount();
    expect(destroySpy).toHaveBeenCalled();
  });

  it("goNext via API advances the view after mount", async () => {
    const { getApi } = mountBook();
    await vi.waitFor(() => expect(getApi()?.getPages().length).toBe(4));
    getApi()!.goNext();
    await vi.waitFor(() => expect(getApi()!.getViewIndex()).toBe(1));
  });

  it("engine is available immediately (no DOM refs required)", async () => {
    let engineReady = false;
    const Comp = defineComponent({
      setup() {
        const { engine } = useToonBook({ pages: ["a.jpg"] });
        engineReady = !!engine;
        return () => null;
      },
    });
    mount(Comp);
    await nextTick();
    expect(engineReady).toBe(true);
  });
});
