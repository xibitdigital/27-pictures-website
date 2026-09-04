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

function mountSession(user: EditorUser | null, signOut = vi.fn(), options?: { attachTo: HTMLElement }) {
  const Host = defineComponent({
    setup() {
      provide(EDITOR_USER_KEY, ref(user));
      provide(EDITOR_LOGOUT_KEY, signOut);
      return () => h(EditorSession);
    },
  });
  return mount(Host, options);
}

describe("EditorSession", () => {
  afterEach(() => {
    vi.mocked(api.fetchCredits).mockReset();
  });

  it("hides the account control when logged out", () => {
    const wrapper = mountSession(null);
    expect(wrapper.find('button[aria-label="Account menu"]').exists()).toBe(false);
  });

  it("opens a menu with monthly credits and logout", async () => {
    vi.mocked(api.fetchCredits).mockResolvedValue({
      audio: { used: 1234, limit: 10000, unit: "chars" },
      image: { used: 0, limit: null, unit: "credits" },
      periodEnd: null,
    });
    const signOut = vi.fn();
    const wrapper = mountSession({ id: "u1", email: "a@b.c" }, signOut, { attachTo: document.body });
    const trigger = wrapper.get('button[aria-label="Account menu"]');
    expect(trigger.text()).toContain("A");
    await trigger.trigger("click");
    await flushPromises();
    expect(api.fetchCredits).toHaveBeenCalled();
    const panel = document.querySelector(".editor-account-panel") as HTMLElement;
    expect(panel.textContent).toContain("a@b.c");
    expect(panel.textContent).toContain("Audio this period");
    expect(panel.textContent).toContain("1,234 / 10,000 chars");
    expect(panel.textContent).toContain("Image this month");
    (panel.querySelector('button[name="logout"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(signOut).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
