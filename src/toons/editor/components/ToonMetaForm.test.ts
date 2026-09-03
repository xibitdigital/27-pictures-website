import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import ToonMetaForm from "./ToonMetaForm.vue";
import * as api from "../api";
import { EDITOR_USER_KEY } from "../session";
import { pickOption } from "../testSelect";

const route = {
  name: "new" as string,
  params: {} as Record<string, string>,
  query: {} as Record<string, string>,
};
const push = vi.fn();

// Production always mounts this form under AuthGate, which provides the
// session — an admin here so tests can exercise the Public status option.
const ADMIN_PROVIDE = {
  [EDITOR_USER_KEY as symbol]: ref({
    id: "admin1",
    email: "admin@example.com",
    username: "admin",
    role: "admin" as const,
  }),
};

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ push }),
  RouterLink: { template: "<a><slot /></a>" },
}));

describe("ToonMetaForm visibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    route.name = "new";
    route.params = {};
    route.query = {};
    push.mockReset();
    vi.spyOn(api, "listSeries").mockResolvedValue([
      { key: "erin", title: "Erin & the Goblins" },
      { key: "jax", title: "Jax" },
    ]);
  });

  it("defaults to draft and posts published when Public is selected", async () => {
    const create = vi.spyOn(api, "createToon").mockResolvedValue({
      id: "t1",
      slug: "demo",
      title: "Demo",
      subtitle: "",
      description: "",
      coverKey: null,
      coverUrl: null,
      designWidth: 800,
      designHeight: 1424,
      status: "published",
      pages: [],
    });

    const wrapper = mount(ToonMetaForm, {
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true }, provide: ADMIN_PROVIDE },
      attachTo: document.body,
    });
    await flushPromises();
    expect(wrapper.get('button[name="visibility"]').text()).toBe("Draft");

    await wrapper.get('input[name="slug"]').setValue("demo");
    await wrapper.get('input[name="title"]').setValue("Demo");
    await pickOption("visibility", "Public");
    await wrapper.get("form").trigger("submit");

    expect(create).toHaveBeenCalledWith({
      slug: "demo",
      title: "Demo",
      subtitle: "",
      description: "",
      descriptions: { en: "", it: "", de: "", fr: "" },
      status: "published",
      seriesKey: null,
      episodeN: null,
    });
    wrapper.unmount();
  });

  it("posts a series key and episode number", async () => {
    const create = vi.spyOn(api, "createToon").mockResolvedValue({
      id: "t1",
      slug: "demo",
      title: "Demo",
      subtitle: "",
      description: "",
      coverKey: null,
      coverUrl: null,
      designWidth: 800,
      designHeight: 1424,
      pages: [],
    });
    const wrapper = mount(ToonMetaForm, {
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true }, provide: ADMIN_PROVIDE },
      attachTo: document.body,
    });
    await wrapper.get('input[name="slug"]').setValue("demo");
    await wrapper.get('input[name="title"]').setValue("Demo");
    await vi.waitFor(async () => {
      await pickOption("series", "Erin & the Goblins");
    });
    await wrapper.get('input[name="episode-n"]').setValue("2");
    await wrapper.get("form").trigger("submit");
    expect(create.mock.calls[0][0].seriesKey).toBe("erin");
    expect(create.mock.calls[0][0].episodeN).toBe(2);
    wrapper.unmount();
  });

  it("posts a description per language", async () => {
    const create = vi.spyOn(api, "createToon").mockResolvedValue({
      id: "t1",
      slug: "demo",
      title: "Demo",
      subtitle: "",
      description: "Hello",
      coverKey: null,
      coverUrl: null,
      designWidth: 800,
      designHeight: 1424,
      pages: [],
    });
    const wrapper = mount(ToonMetaForm, {
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true }, provide: ADMIN_PROVIDE },
    });
    await wrapper.get('input[name="slug"]').setValue("demo");
    await wrapper.get('input[name="title"]').setValue("Demo");
    await wrapper.get('textarea[name="description-en"]').setValue("Hello");
    await wrapper.get('textarea[name="description-it"]').setValue("Ciao");
    await wrapper.get("form").trigger("submit");
    expect(create.mock.calls[0][0].descriptions).toEqual({
      en: "Hello",
      it: "Ciao",
      de: "",
      fr: "",
    });
    expect(create.mock.calls[0][0].description).toBe("Hello");
  });

  it("posts staging when Staging is selected", async () => {
    const create = vi.spyOn(api, "createToon").mockResolvedValue({
      id: "t1",
      slug: "demo",
      title: "Demo",
      subtitle: "",
      description: "",
      coverKey: null,
      coverUrl: null,
      designWidth: 800,
      designHeight: 1424,
      status: "staging",
      pages: [],
    });
    const wrapper = mount(ToonMetaForm, {
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true }, provide: ADMIN_PROVIDE },
      attachTo: document.body,
    });
    await wrapper.get('input[name="slug"]').setValue("demo");
    await wrapper.get('input[name="title"]').setValue("Demo");
    await pickOption("visibility", "Staging");
    expect(wrapper.text()).toContain("staging.twentyseven.pictures");
    await wrapper.get("form").trigger("submit");
    expect(create.mock.calls[0][0].status).toBe("staging");
    expect(push).toHaveBeenCalledWith("/t1/pages");
    wrapper.unmount();
  });

  it("stays on the meta form after saving an existing toon", async () => {
    route.name = "meta";
    route.params = { id: "t1" };
    vi.spyOn(api, "getToon").mockResolvedValue({
      id: "t1",
      slug: "demo",
      title: "Demo",
      subtitle: "",
      description: "",
      coverKey: null,
      coverUrl: null,
      designWidth: 800,
      designHeight: 1424,
      status: "draft",
      pages: [],
    });
    const patch = vi.spyOn(api, "patchToon").mockResolvedValue({
      id: "t1",
      slug: "demo",
      title: "Demo",
      subtitle: "",
      description: "",
      coverKey: null,
      coverUrl: null,
      designWidth: 800,
      designHeight: 1424,
      status: "published",
      pages: [],
    });
    const wrapper = mount(ToonMetaForm, {
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true }, provide: ADMIN_PROVIDE },
      attachTo: document.body,
    });
    await vi.waitFor(() => expect(wrapper.get('input[name="title"]').element).toHaveProperty("value", "Demo"));
    await pickOption("visibility", "Public");
    await wrapper.get("form").trigger("submit");
    expect(patch).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "published" }));
    expect(push).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("hides Public from an editor session", async () => {
    route.name = "meta";
    route.params = { id: "t1" };
    vi.spyOn(api, "getToon").mockResolvedValue({
      id: "t1",
      slug: "demo",
      title: "Demo",
      subtitle: "",
      description: "",
      coverKey: null,
      coverUrl: null,
      designWidth: 800,
      designHeight: 1424,
      status: "draft",
      pages: [],
    });
    const editorProvide = {
      [EDITOR_USER_KEY as symbol]: ref({ id: "u1", email: "e@example.com", username: "e", role: "editor" as const }),
    };
    const wrapper = mount(ToonMetaForm, {
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true }, provide: editorProvide },
      attachTo: document.body,
    });
    await vi.waitFor(() => expect(wrapper.get('input[name="title"]').element).toHaveProperty("value", "Demo"));
    await wrapper.get('button[name="visibility"]').trigger("pointerdown");
    await wrapper.vm.$nextTick();
    const optionTexts = [...document.querySelectorAll('[role="option"]')].map((el) => el.textContent?.trim());
    expect(optionTexts).toEqual(["Draft", "Staging"]);
    wrapper.unmount();
  });

  it("pre-fills series and episode from the query when adding from a series page", async () => {
    route.query = { series: "erin", episode: "3" };
    const wrapper = mount(ToonMetaForm, {
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true }, provide: ADMIN_PROVIDE },
    });
    await vi.waitFor(() => expect(wrapper.get('button[name="series"]').text()).toBe("Erin & the Goblins"));
    expect((wrapper.get('input[name="episode-n"]').element as HTMLInputElement).value).toBe("3");
  });
});
