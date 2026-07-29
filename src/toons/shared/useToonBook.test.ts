import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { useToonBook } from "./useToonBook";
import {
  mountBookFixture,
  stubReaderMatchMedia,
  stubImagePreload,
  stubManifestFetch,
  FOUR_PAGES,
} from "@/test/bookFixture";

function mountWithBook(
  factory: (els: ReturnType<typeof mountBookFixture>) => ReturnType<typeof useToonBook>
) {
  const els = mountBookFixture();
  let apiGetter: ReturnType<typeof useToonBook> | undefined;

  const Comp = defineComponent({
    setup() {
      apiGetter = factory(els);
      return () => null;
    },
  });

  const wrapper = mount(Comp);
  return { wrapper, els, getApi: () => apiGetter!.getApi() };
}

describe("useToonBook", () => {
  beforeEach(() => {
    stubReaderMatchMedia("reduce-motion");
    stubImagePreload();
    stubManifestFetch(FOUR_PAGES);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("initializes the reader after mount when refs resolve", async () => {
    const { getApi, els } = mountWithBook((els) =>
      useToonBook(
        {
          book: ref(els.book),
          slotLeft: ref(els.slotLeft),
          slotRight: ref(els.slotRight),
          indicator: ref(els.indicator),
          btnPrev: ref(els.btnPrev),
          btnNext: ref(els.btnNext),
          zoneNext: ref(els.zoneNext),
          zonePrev: ref(els.zonePrev),
          topControls: ref(els.topControls),
        },
        { altPrefix: "Jax" }
      )
    );

    await flushPromises();
    await vi.waitFor(() => {
      expect(getApi()).toBeDefined();
      expect(getApi()!.getPages().length).toBe(4);
    });

    expect(els.slotLeft.querySelector(".front-cover-instructions")).toBeTruthy();
  });

  it("logs and skips init when required refs are null", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let getApi!: () => ReturnType<typeof useToonBook>["getApi"] extends () => infer R
      ? R
      : never;

    const Comp = defineComponent({
      setup() {
        const result = useToonBook(
          {
            book: ref(null),
            slotLeft: ref(null),
            slotRight: ref(null),
            indicator: ref(null),
            btnPrev: ref(null),
            btnNext: ref(null),
          },
          {}
        );
        getApi = result.getApi as typeof getApi;
        return () => null;
      },
    });
    mount(Comp);
    await nextTick();
    expect(getApi()).toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("destroys the reader on unmount", async () => {
    const { wrapper, getApi } = mountWithBook((els) =>
      useToonBook(
        {
          book: ref(els.book),
          slotLeft: ref(els.slotLeft),
          slotRight: ref(els.slotRight),
          indicator: ref(els.indicator),
          btnPrev: ref(els.btnPrev),
          btnNext: ref(els.btnNext),
        },
        {}
      )
    );

    await vi.waitFor(() => expect(getApi()?.getPages().length).toBe(4));
    const api = getApi()!;
    const destroySpy = vi.spyOn(api, "destroy");

    wrapper.unmount();
    expect(destroySpy).toHaveBeenCalled();
  });

  it("goNext via API advances the view after mount", async () => {
    const { getApi } = mountWithBook((els) =>
      useToonBook(
        {
          book: ref(els.book),
          slotLeft: ref(els.slotLeft),
          slotRight: ref(els.slotRight),
          indicator: ref(els.indicator),
          btnPrev: ref(els.btnPrev),
          btnNext: ref(els.btnNext),
          zoneNext: ref(els.zoneNext),
          zonePrev: ref(els.zonePrev),
        },
        {}
      )
    );

    await vi.waitFor(() => expect(getApi()?.getPages().length).toBe(4));
    getApi()!.goNext();
    await vi.waitFor(() => expect(getApi()!.getViewIndex()).toBe(1));
  });
});
