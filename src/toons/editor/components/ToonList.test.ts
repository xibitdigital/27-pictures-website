import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import ToonList from "./ToonList.vue";
import * as api from "../api";
import { EDITOR_USER_KEY } from "../session";

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
      { key: "test", title: "Test", tagline: "", toonCount: 0, coverUrl: null },
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
          EditorBar: { template: '<div><slot name="start" /><slot name="after-title" /><slot name="actions" /></div>' },
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
    expect(wrapper.text()).toContain("No episodes yet");
    expect(wrapper.get(".editor-cover-placeholder").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Manage users");
    expect(wrapper.get('button[name="visibility-filter-all"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('button[name="catalog-filter-studio"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get("[data-toon-count]").text()).toBe("2");
  });

  it("splits the shelf between 27 Pictures and the creator site", async () => {
    vi.spyOn(api, "listSeries").mockResolvedValue([
      { key: "red-smile", title: "RED SMILE", tagline: "Horror", toonCount: 1, coverUrl: null, publishSite: "studio" },
      { key: "indie", title: "Indie", tagline: "", toonCount: 1, coverUrl: null, publishSite: "community" },
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
        publishSite: "studio",
      },
      {
        id: "b",
        slug: "indie-ep",
        title: "Indie ep",
        coverUrl: null,
        pageCount: 4,
        status: "draft",
        seriesKey: "indie",
        episodeN: 1,
        publishSite: "community",
      },
    ]);
    const wrapper = mount(ToonList, {
      global: {
        stubs: {
          EditorBar: { template: '<div><slot name="start" /><slot name="after-title" /><slot name="actions" /></div>' },
          EditorSession: true,
        },
      },
    });
    await vi.waitFor(() => expect(wrapper.text()).toContain("RED SMILE"));
    expect(wrapper.text()).toContain("static");
    expect(wrapper.text()).not.toContain("Indie ep");
    await wrapper.get('button[name="catalog-filter-community"]').trigger("click");
    expect(wrapper.get('button[name="catalog-filter-community"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.text()).toContain("Indie");
    expect(wrapper.text()).toContain("Indie ep");
    expect(wrapper.text()).not.toContain("RED SMILE");
    expect(wrapper.get("[data-toon-count]").text()).toBe("1");
  });

  it("filters the shelf to one visibility", async () => {
    vi.spyOn(api, "listSeries").mockResolvedValue([
      { key: "red-smile", title: "RED SMILE", tagline: "Horror", toonCount: 2, coverUrl: null },
      { key: "test", title: "Test", tagline: "", toonCount: 0, coverUrl: null },
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
      {
        id: "c",
        slug: "stage",
        title: "Stage",
        coverUrl: null,
        pageCount: 2,
        status: "staging",
        seriesKey: "red-smile",
        episodeN: 2,
      },
    ]);
    const wrapper = mount(ToonList, {
      global: {
        stubs: {
          EditorBar: { template: '<div><slot name="start" /><slot name="after-title" /><slot name="actions" /></div>' },
          EditorSession: true,
        },
      },
    });
    await vi.waitFor(() => expect(wrapper.text()).toContain("static"));
    expect(wrapper.get("[data-toon-count]").text()).toBe("3");
    await wrapper.get('button[name="visibility-filter-draft"]').trigger("click");
    expect(wrapper.get("[data-toon-count]").text()).toBe("1");
    expect(wrapper.text()).toContain("Loose");
    expect(wrapper.text()).not.toContain("static");
    expect(wrapper.text()).not.toContain("Stage");
    expect(wrapper.text()).not.toContain("No episodes yet");
    await wrapper.get('button[name="visibility-filter-public"]').trigger("click");
    expect(wrapper.text()).toContain("static");
    expect(wrapper.text()).not.toContain("Loose");
    expect(wrapper.get('button[name="visibility-filter-public"]').attributes("aria-pressed")).toBe("true");
  });

  it("shows Manage users only for an admin session", async () => {
    vi.spyOn(api, "listSeries").mockResolvedValue([]);
    vi.spyOn(api, "listToons").mockResolvedValue([]);
    const wrapper = mount(ToonList, {
      global: {
        stubs: {
          EditorBar: { template: '<div><slot name="start" /><slot name="after-title" /><slot name="actions" /></div>' },
          EditorSession: true,
        },
        provide: {
          [EDITOR_USER_KEY as symbol]: ref({ id: "u1", email: "a@a.com", username: "a", role: "admin" as const }),
        },
      },
    });
    await vi.waitFor(() => expect(wrapper.text()).toContain("Manage users"));
  });
});
