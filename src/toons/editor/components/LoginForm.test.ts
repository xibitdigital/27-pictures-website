import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import LoginForm from "./LoginForm.vue";
import * as api from "../api";
import { toasts } from "../toast";

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    toasts.splice(0, toasts.length);
  });

  it("creates the first account when no users exist", async () => {
    const register = vi.spyOn(api, "register").mockResolvedValue({
      token: "t",
      user: { id: "u1", email: "marco@twentyseven.pictures" },
    });
    vi.spyOn(api, "setToken").mockImplementation(() => {});

    const wrapper = mount(LoginForm, { props: { hasUsers: false } });
    expect(wrapper.get("h1").text()).toBe("Create editor account");
    expect(wrapper.find('a[href="/#contact"]').exists()).toBe(false);
    await wrapper.get('input[name="email"]').setValue("marco@twentyseven.pictures");
    await wrapper.get('input[name="password"]').setValue("a-long-password");
    await wrapper.get("form").trigger("submit");

    expect(register).toHaveBeenCalledWith("marco@twentyseven.pictures", "a-long-password");
    expect(wrapper.emitted("loggedIn")?.[0][0]).toEqual({ id: "u1", email: "marco@twentyseven.pictures" });
  });

  it("logs in against an existing account", async () => {
    const login = vi.spyOn(api, "login").mockResolvedValue({
      token: "t",
      user: { id: "u1", email: "marco@twentyseven.pictures" },
    });
    vi.spyOn(api, "setToken").mockImplementation(() => {});

    const wrapper = mount(LoginForm, { props: { hasUsers: true } });
    const logo = wrapper.get(".editor-gate-logo img");
    expect(logo.attributes("alt")).toBe("27 Pictures");
    expect(logo.attributes("src")).toContain("logo");
    expect(wrapper.get(".editor-gate-product").text()).toBe("FlipFrame Studio");
    expect(wrapper.get(".editor-gate-tagline").text()).toMatch(/turn, not watch/i);
    expect(wrapper.get("h1").text()).toBe("Log in");
    const invite = wrapper.get('a[href="/#contact"]');
    expect(invite.text()).toMatch(/contact form/i);
    await wrapper.get('input[name="email"]').setValue("marco@twentyseven.pictures");
    await wrapper.get('input[name="password"]').setValue("a-long-password");
    await wrapper.get("form").trigger("submit");

    expect(login).toHaveBeenCalledWith("marco@twentyseven.pictures", "a-long-password");
    expect(wrapper.emitted("loggedIn")).toHaveLength(1);
  });

  it("warns and disables sign-in when the viewport is below the iPad floor", async () => {
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    const login = vi.spyOn(api, "login");
    const wrapper = mount(LoginForm, { props: { hasUsers: true } });

    const size = wrapper.get("[data-editor-size]");
    expect(size.text()).toMatch(/FlipFrame Studio needs an iPad or a desktop/i);
    expect(size.attributes("role")).toBe("alert");
    expect(size.classes()).toContain("editor-error");
    expect(wrapper.get("button[type='submit']").attributes("disabled")).toBeDefined();

    await wrapper.get('input[name="email"]').setValue("x@y.z");
    await wrapper.get('input[name="password"]').setValue("password1");
    await wrapper.get("form").trigger("submit");
    expect(login).not.toHaveBeenCalled();
  });

  it("clears the size warning after a resize that fits", async () => {
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    const wrapper = mount(LoginForm, { props: { hasUsers: true } });
    expect(wrapper.find("[data-editor-size]").exists()).toBe(true);

    vi.stubGlobal("innerWidth", 1024);
    vi.stubGlobal("innerHeight", 768);
    window.dispatchEvent(new Event("resize"));
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[data-editor-size]").exists()).toBe(false);
    expect(wrapper.get("button[type='submit']").attributes("disabled")).toBeUndefined();
  });

  it("toasts the Worker error on a failed login", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("invalid email or password"));
    const wrapper = mount(LoginForm, { props: { hasUsers: true } });
    await wrapper.get('input[name="email"]').setValue("x@y.z");
    await wrapper.get('input[name="password"]').setValue("wrong-pass");
    await wrapper.get("form").trigger("submit");
    expect(toasts.map((t) => t.message)).toEqual(["invalid email or password"]);
  });
});
