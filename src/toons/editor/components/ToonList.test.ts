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
    expect(wrapper.text()).toContain("No episodes yet");
    expect(wrapper.get(".editor-cover-placeholder").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Invite user");
  });

  it("shows Invite user only for an admin session", async () => {
    vi.spyOn(api, "listSeries").mockResolvedValue([]);
    vi.spyOn(api, "listToons").mockResolvedValue([]);
    const wrapper = mount(ToonList, {
      global: {
        stubs: {
          EditorBar: { template: '<div><slot name="start" /><slot name="actions" /></div>' },
          EditorSession: true,
        },
        provide: {
          [EDITOR_USER_KEY as symbol]: ref({ id: "u1", email: "a@a.com", username: "a", role: "admin" as const }),
        },
      },
    });
    await vi.waitFor(() => expect(wrapper.text()).toContain("Invite user"));
  });
});
