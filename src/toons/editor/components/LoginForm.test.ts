import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import LoginForm from "./LoginForm.vue";
import * as api from "../api";

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("creates the first account when no users exist", async () => {
    const register = vi.spyOn(api, "register").mockResolvedValue({
      token: "t",
      user: { id: "u1", email: "marco@twentyseven.pictures" },
    });
    vi.spyOn(api, "setToken").mockImplementation(() => {});

    const wrapper = mount(LoginForm, { props: { hasUsers: false } });
    expect(wrapper.get("h1").text()).toBe("Create editor account");
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
    expect(wrapper.get("h1").text()).toBe("Log in");
    await wrapper.get('input[name="email"]').setValue("marco@twentyseven.pictures");
    await wrapper.get('input[name="password"]').setValue("a-long-password");
    await wrapper.get("form").trigger("submit");

    expect(login).toHaveBeenCalledWith("marco@twentyseven.pictures", "a-long-password");
    expect(wrapper.emitted("loggedIn")).toHaveLength(1);
  });

  it("shows the Worker error on a failed login", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("invalid email or password"));
    const wrapper = mount(LoginForm, { props: { hasUsers: true } });
    await wrapper.get('input[name="email"]').setValue("x@y.z");
    await wrapper.get('input[name="password"]').setValue("wrong-pass");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.get('[role="alert"]').text()).toBe("invalid email or password");
  });
});
