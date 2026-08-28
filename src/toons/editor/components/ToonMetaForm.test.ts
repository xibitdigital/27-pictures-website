import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ToonMetaForm from "./ToonMetaForm.vue";
import * as api from "../api";

vi.mock("vue-router", () => ({
  useRoute: () => ({ name: "new", params: {} }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: "<a><slot /></a>" },
}));

describe("ToonMetaForm visibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true } },
    });
    const select = wrapper.get('select[name="visibility"]');
    expect((select.element as HTMLSelectElement).value).toBe("draft");
    expect(select.findAll("option").map((o) => (o.element as HTMLOptionElement).value)).toEqual([
      "draft",
      "staging",
      "public",
    ]);

    await wrapper.get('input[name="slug"]').setValue("demo");
    await wrapper.get('input[name="title"]').setValue("Demo");
    await select.setValue("public");
    await wrapper.get("form").trigger("submit");

    expect(create).toHaveBeenCalledWith({
      slug: "demo",
      title: "Demo",
      subtitle: "",
      description: "",
      descriptions: { en: "", it: "", de: "", fr: "" },
      status: "published",
    });
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
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true } },
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
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true } },
    });
    await wrapper.get('input[name="slug"]').setValue("demo");
    await wrapper.get('input[name="title"]').setValue("Demo");
    await wrapper.get('select[name="visibility"]').setValue("staging");
    expect(wrapper.text()).toContain("staging.twentyseven.pictures");
    await wrapper.get("form").trigger("submit");
    expect(create.mock.calls[0][0].status).toBe("staging");
  });
});
