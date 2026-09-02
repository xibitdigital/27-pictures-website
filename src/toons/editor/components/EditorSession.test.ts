import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, provide, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import EditorSession from "./EditorSession.vue";
import { EDITOR_LOGOUT_KEY, EDITOR_USER_KEY } from "../session";
import * as api from "../api";
import type { EditorUser } from "../types";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, fetchCredits: vi.fn() };
});

function mountSession(user: EditorUser | null, signOut = vi.fn()) {
  const Host = defineComponent({
    setup() {
      provide(EDITOR_USER_KEY, ref(user));
      provide(EDITOR_LOGOUT_KEY, signOut);
      return () => h(EditorSession);
    },
  });
  return mount(Host);
}

describe("EditorSession", () => {
  afterEach(() => {
    vi.mocked(api.fetchCredits).mockReset();
  });

  it("hides the account control when logged out", () => {
    const wrapper = mountSession(null);
    expect(wrapper.find('summary[aria-label="Account menu"]').exists()).toBe(false);
  });

  it("opens a menu with monthly credits and logout", async () => {
    vi.mocked(api.fetchCredits).mockResolvedValue({
      audio: { used: 1234, limit: 10000, unit: "chars" },
      image: { used: 0, limit: null, unit: "credits" },
      periodEnd: null,
    });
    const signOut = vi.fn();
    const wrapper = mountSession({ id: "u1", email: "a@b.c" }, signOut);
    const summary = wrapper.get('summary[aria-label="Account menu"]');
    expect(summary.text()).toContain("A");
    wrapper.get("details").element.open = true;
    await wrapper.get("details").trigger("toggle");
    await flushPromises();
    expect(api.fetchCredits).toHaveBeenCalled();
    expect(wrapper.text()).toContain("a@b.c");
    expect(wrapper.text()).toContain("Audio this period");
    expect(wrapper.text()).toContain("1,234 / 10,000 chars");
    expect(wrapper.text()).toContain("Image this month");
    await wrapper.get('button[name="logout"]').trigger("click");
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
