import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import SeriesForm from "./SeriesForm.vue";
import * as api from "../api";

const push = vi.fn();

vi.mock("vue-router", () => ({
  useRoute: () => ({ name: "series-new", params: {} }),
  useRouter: () => ({ push }),
}));

describe("SeriesForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
  });

  it("puts a new series and sends the key", async () => {
    const save = vi.spyOn(api, "saveSeries").mockResolvedValue({
      key: "red-smile",
      title: "RED SMILE",
      tagline: "Horror",
    });
    const wrapper = mount(SeriesForm, {
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true } },
    });
    await wrapper.get('input[name="title"]').setValue("RED SMILE");
    await wrapper.get('input[name="tagline"]').setValue("Horror");
    await wrapper.get("form").trigger("submit");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "red-smile",
        title: "RED SMILE",
        tagline: "Horror",
        hubUrl: "/toons/red-smile/",
        generate: expect.objectContaining({
          width: 1152,
          height: 1728,
          model: "seedream 5.0 pro",
        }),
      })
    );
    expect(push).toHaveBeenCalledWith("/series/red-smile");
  });
});
