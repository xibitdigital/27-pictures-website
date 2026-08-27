import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, inject } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import AuthGate from "./AuthGate.vue";
import { EDITOR_LOGOUT_KEY } from "./session";
import * as api from "./api";

const LogoutSlot = defineComponent({
  setup() {
    const signOut = inject(EDITOR_LOGOUT_KEY);
    return () => h("button", { type: "button", onClick: () => signOut?.() }, "out");
  },
});

describe("AuthGate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("after the first account is created, logout shows Log in not Create account", async () => {
    vi.spyOn(api, "editorApiBase").mockReturnValue("https://editor.example.dev");
    const status = vi.spyOn(api, "authStatus").mockResolvedValue({ hasUsers: false });
    vi.spyOn(api, "getToken").mockReturnValue("");
    vi.spyOn(api, "register").mockResolvedValue({
      token: "t",
      user: { id: "u1", email: "a@b.c" },
    });
    vi.spyOn(api, "setToken").mockImplementation(() => {});
    vi.spyOn(api, "logout").mockImplementation(async () => {
      status.mockResolvedValue({ hasUsers: true });
    });

    const wrapper = mount(AuthGate, {
      slots: { default: () => h(LogoutSlot) },
    });
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Create editor account");

    await wrapper.get('input[name="email"]').setValue("a@b.c");
    await wrapper.get('input[name="password"]').setValue("password1");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get("button").text()).toBe("out");

    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Log in");
  });
});
