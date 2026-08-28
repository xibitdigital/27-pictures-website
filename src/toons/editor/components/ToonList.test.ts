import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ToonList from "./ToonList.vue";
import * as api from "../api";

vi.mock("vue-router", () => ({
  RouterLink: { template: '<a :href="to"><slot /></a>', props: ["to"] },
}));

describe("ToonList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists series and groups episode cards under them", async () => {
    vi.spyOn(api, "listSeries").mockResolvedValue([
      { key: "red-smile", title: "RED SMILE", tagline: "Horror", toonCount: 2, coverUrl: null },
    ]);
    vi.spyOn(api, "listToons").mockResolvedValue([
      {
        id: "a",
        slug: "redsmile-static",
        title: "static",
        coverUrl: null,
        pageCount: 12,
        status: "published",
        seriesKey: "red-smile",
        episodeN: 1,
      },
      {
        id: "b",
        slug: "loose",
        title: "Loose",
        coverUrl: null,
        pageCount: 1,
        status: "draft",
      },
    ]);
    const wrapper = mount(ToonList, {
      global: {
        stubs: {
          EditorBar: { template: '<div><slot name="start" /><slot name="actions" /></div>' },
          EditorSession: true,
        },
      },
    });
    await vi.waitFor(() => expect(wrapper.text()).toContain("RED SMILE"));
    expect(wrapper.text()).toContain("New series");
    expect(wrapper.text()).toContain("static");
    expect(wrapper.text()).toContain("Ungrouped");
    expect(wrapper.text()).toContain("Loose");
    expect(wrapper.text()).toContain("Public");
    expect(wrapper.text()).toContain("Draft");
  });
});
