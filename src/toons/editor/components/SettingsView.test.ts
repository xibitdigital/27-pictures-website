import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import SettingsView from "./SettingsView.vue";
import * as api from "../api";
import { USER_KEY_LINKS, USER_KEY_NAMES } from "../types";

describe("SettingsView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("links each key field to where to get one", async () => {
    vi.spyOn(api, "getUserKeys").mockResolvedValue({
      replicateApiToken: false,
      comfyApiKey: false,
      elevenlabsApiKey: false,
      runwareApiToken: false,
      runcomfyApiToken: false,
    });
    const wrapper = mount(SettingsView, { global: { stubs: { EditorBar: true } } });
    await flushPromises();

    for (const name of USER_KEY_NAMES) {
      const link = wrapper.get(`a[href="${USER_KEY_LINKS[name]}"]`);
      expect(link.text()).toBe("Get a key");
      expect(link.attributes("target")).toBe("_blank");
      expect(link.attributes("rel")).toBe("noopener");
    }
  });
});
