import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import SeriesForm from "./SeriesForm.vue";
import * as api from "../api";
import { EDITOR_USER_KEY } from "../session";
import { pickOption } from "../testSelect";

const { push, useRoute } = vi.hoisted(() => ({
  push: vi.fn(),
  useRoute: vi.fn(() => ({ name: "series-new", params: {} })),
}));

vi.mock("vue-router", () => ({
  useRoute,
  useRouter: () => ({ push }),
}));

describe("SeriesForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
    useRoute.mockReturnValue({ name: "series-new", params: {} });
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

  it("lets the user pick a prompt target and saves it", async () => {
    vi.spyOn(api, "getSeries").mockResolvedValue({
      series: {
        key: "erin",
        title: "Erin & the Goblins",
        tagline: "",
        generate: {
          width: 1152,
          height: 1728,
          model: "seedream 5.0 pro",
          flowKey: "editor/_series/erin/flow/a.json",
          flowUrl: "https://toon-editor.example/media/editor/_series/erin/flow/a.json",
          slots: [],
          promptCandidates: [
            { nodeId: "12", inputKey: "string_b", label: "#12 Concatenate Text · string_b", preview: "SUBJECT LOCK…" },
            { nodeId: "25", inputKey: "value", label: "#25 Text (Multiline) · value", preview: "FORMAT…" },
          ],
          promptTarget: null,
        },
      },
      toons: [],
    });
    const save = vi.spyOn(api, "saveSeries").mockResolvedValue({ key: "erin", title: "Erin & the Goblins" });
    useRoute.mockReturnValue({ name: "series-edit", params: { key: "erin" } });
    const wrapper = mount(SeriesForm, {
      global: { stubs: { EditorBar: true, ToonCard: true, EditorSession: true } },
      attachTo: document.body,
    });
    await flushPromises();
    await pickOption("prompt-target", "#12 Concatenate Text · string_b — “SUBJECT LOCK…”");
    await wrapper.get("form").trigger("submit");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        generate: expect.objectContaining({ promptTarget: { nodeId: "12", inputKey: "string_b" } }),
      })
    );
  });

  it("lets an admin assign editors from the roster and sends the selected ids", async () => {
    vi.spyOn(api, "listUsers").mockResolvedValue([
      { id: "e1", email: "eve@example.com", username: "eve", role: "editor" },
      { id: "e2", email: "sam@example.com", username: "sam", role: "editor" },
      { id: "a1", email: "adm@example.com", username: "adm", role: "admin" },
    ]);
    const save = vi.spyOn(api, "saveSeries").mockResolvedValue({ key: "red-smile", title: "RED SMILE" });
    const wrapper = mount(SeriesForm, {
      global: {
        stubs: { EditorBar: true, ToonCard: true, EditorSession: true },
        provide: {
          [EDITOR_USER_KEY as symbol]: ref({ id: "u1", email: "a@example.com", username: "a", role: "admin" as const }),
        },
      },
    });
    await flushPromises();
    const checkboxes = wrapper.findAll('button[role="checkbox"]');
    expect(checkboxes).toHaveLength(2); // admins aren't offered as series editors
    await wrapper.get('input[name="title"]').setValue("RED SMILE");
    await checkboxes[0].trigger("click");
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ editorIds: ["e1"] }));
  });

  it("hides the Editors section for an editor session", async () => {
    const listUsers = vi.spyOn(api, "listUsers");
    const wrapper = mount(SeriesForm, {
      global: {
        stubs: { EditorBar: true, ToonCard: true, EditorSession: true },
        provide: {
          [EDITOR_USER_KEY as symbol]: ref({
            id: "u1",
            email: "e@example.com",
            username: "e",
            role: "editor" as const,
          }),
        },
      },
    });
    await flushPromises();
    expect(listUsers).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("Editors");
  });
});
