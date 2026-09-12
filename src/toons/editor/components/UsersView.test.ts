import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import UsersView from "./UsersView.vue";
import * as api from "../api";
import { EDITOR_USER_KEY } from "../session";
import { pickOption } from "../testSelect";
import { toasts } from "../toast";

const replace = vi.fn();

vi.mock("vue-router", () => ({
  useRouter: () => ({ replace }),
}));

function provideUser(role: "admin" | "editor") {
  return { [EDITOR_USER_KEY as symbol]: ref({ id: "u1", email: "u1@example.com", username: "u1", role }) };
}

describe("UsersView", () => {
  beforeEach(() => {
    vi.spyOn(api, "listUsers").mockResolvedValue([
      { id: "u1", email: "u1@example.com", username: "u1", role: "admin" },
      { id: "u2", email: "u2@example.com", username: "u2", role: "editor" },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    replace.mockReset();
    toasts.splice(0, toasts.length);
  });

  it("sends an invite with the trimmed form values and reports success", async () => {
    const invite = vi.spyOn(api, "inviteUser").mockResolvedValue({
      user: { id: "u2", email: "new@example.com", username: "newbie", role: "editor" },
      emailSent: true,
    });
    const wrapper = mount(UsersView, {
      global: { stubs: { EditorBar: true }, provide: provideUser("admin") },
    });
    await wrapper.get('input[name="username"]').setValue("  newbie  ");
    await wrapper.get('input[name="email"]').setValue("  new@example.com  ");
    await wrapper.get("form").trigger("submit");
    expect(invite).toHaveBeenCalledWith({
      username: "newbie",
      email: "new@example.com",
      role: "editor",
      turnstileToken: "",
    });
    expect(toasts.some((t) => t.kind === "success" && t.message.includes("new@example.com"))).toBe(true);
  });

  it("reports when the account was created but the email failed to send", async () => {
    vi.spyOn(api, "inviteUser").mockResolvedValue({
      user: { id: "u2", email: "new@example.com", username: "newbie", role: "editor" },
      emailSent: false,
    });
    const wrapper = mount(UsersView, {
      global: { stubs: { EditorBar: true }, provide: provideUser("admin") },
    });
    await wrapper.get('input[name="username"]').setValue("newbie");
    await wrapper.get('input[name="email"]').setValue("new@example.com");
    await wrapper.get("form").trigger("submit");
    expect(toasts.some((t) => t.kind === "error" && t.message.includes("invite email failed to send"))).toBe(true);
  });

  it("redirects a non-admin session away", () => {
    mount(UsersView, {
      global: { stubs: { EditorBar: true }, provide: provideUser("editor") },
    });
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("waits for the Turnstile challenge before submitting when the widget is loaded", async () => {
    const invite = vi.spyOn(api, "inviteUser").mockResolvedValue({
      user: { id: "u2", email: "new@example.com", username: "newbie", role: "editor" },
      emailSent: true,
    });
    let turnstileCallback: ((token: string) => void) | null = null;
    const execute = vi.fn();
    window.turnstile = {
      execute,
      reset: vi.fn(),
      remove: vi.fn(),
      render: vi.fn((_el, options: Record<string, unknown>) => {
        turnstileCallback = options.callback as (token: string) => void;
        return "widget-1";
      }),
    };
    const wrapper = mount(UsersView, {
      global: { stubs: { EditorBar: true }, provide: provideUser("admin") },
    });
    await wrapper.get('input[name="username"]').setValue("newbie");
    await wrapper.get('input[name="email"]').setValue("new@example.com");
    await wrapper.get("form").trigger("submit");
    expect(execute).toHaveBeenCalled();
    expect(invite).not.toHaveBeenCalled();
    turnstileCallback?.("a-real-token");
    await vi.waitFor(() => expect(invite).toHaveBeenCalled());
    expect(invite).toHaveBeenCalledWith(expect.objectContaining({ turnstileToken: "a-real-token" }));
    delete window.turnstile;
  });

  it("lists existing users with a resend-password button each", async () => {
    const wrapper = mount(UsersView, {
      global: { stubs: { EditorBar: true }, provide: provideUser("admin") },
    });
    await flushPromises();
    const rows = wrapper.findAll(".editor-user-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("u1@example.com");
    expect(rows[0].find(".editor-user-row-actions button").text()).toBe("Resend password");
  });

  it("resends a password and reports success", async () => {
    const resend = vi.spyOn(api, "resendPassword").mockResolvedValue({
      user: { id: "u2", email: "u2@example.com", username: "u2", role: "editor" },
      emailSent: true,
    });
    const wrapper = mount(UsersView, {
      global: { stubs: { EditorBar: true }, provide: provideUser("admin") },
    });
    await flushPromises();
    const rows = wrapper.findAll(".editor-user-row");
    await rows[1].find(".editor-user-row-actions button").trigger("click");
    expect(resend).toHaveBeenCalledWith("u2");
    await flushPromises();
    expect(toasts.some((t) => t.kind === "success" && t.message.includes("u2@example.com"))).toBe(true);
  });

  it("reports when the password was reset but the email failed to send", async () => {
    vi.spyOn(api, "resendPassword").mockResolvedValue({
      user: { id: "u2", email: "u2@example.com", username: "u2", role: "editor" },
      emailSent: false,
    });
    const wrapper = mount(UsersView, {
      global: { stubs: { EditorBar: true }, provide: provideUser("admin") },
    });
    await flushPromises();
    const rows = wrapper.findAll(".editor-user-row");
    await rows[1].find(".editor-user-row-actions button").trigger("click");
    await flushPromises();
    expect(toasts.some((t) => t.kind === "error" && t.message.includes("failed to send"))).toBe(true);
  });

  it("shows each user's role and lets an admin change another user's role", async () => {
    const updateRole = vi
      .spyOn(api, "updateUserRole")
      .mockResolvedValue({ id: "u2", email: "u2@example.com", username: "u2", role: "admin" });
    const wrapper = mount(UsersView, {
      attachTo: document.body,
      global: { stubs: { EditorBar: true }, provide: provideUser("admin") },
    });
    await flushPromises();
    expect(document.querySelector('button[name="role-u1"]')?.textContent).toContain("Admin");
    expect(document.querySelector('button[name="role-u2"]')?.textContent).toContain("Editor");
    // The signed-in admin's own row can't change its own role.
    expect(document.querySelector('button[name="role-u1"]')?.hasAttribute("disabled")).toBe(true);

    await pickOption("role-u2", "Admin");
    expect(updateRole).toHaveBeenCalledWith("u2", "admin");
    await flushPromises();
    expect(toasts.some((t) => t.kind === "success" && t.message.includes("u2"))).toBe(true);
    wrapper.unmount();
  });

  it("reverts the role on failure and toasts the error", async () => {
    vi.spyOn(api, "updateUserRole").mockRejectedValue(new Error("could not change role"));
    const wrapper = mount(UsersView, {
      attachTo: document.body,
      global: { stubs: { EditorBar: true }, provide: provideUser("admin") },
    });
    await flushPromises();
    await pickOption("role-u2", "Admin");
    await flushPromises();
    expect(toasts.some((t) => t.kind === "error" && t.message === "could not change role")).toBe(true);
    expect(document.querySelector('button[name="role-u2"]')?.textContent).toContain("Editor");
    wrapper.unmount();
  });

  const confirmDialogStub = {
    props: ["open", "title", "message", "confirmLabel", "cancelLabel", "focusConfirm"],
    emits: ["confirm", "cancel"],
    template: `<div v-if="open" data-confirm-dialog>
      <p>{{ message }}</p>
      <button data-confirm-yes @click="$emit('confirm')">{{ confirmLabel }}</button>
      <button data-confirm-no @click="$emit('cancel')">{{ cancelLabel }}</button>
    </div>`,
  };

  it("does not offer to remove the caller's own account", async () => {
    const wrapper = mount(UsersView, {
      global: { stubs: { EditorBar: true, ConfirmDialog: confirmDialogStub }, provide: provideUser("admin") },
    });
    await flushPromises();
    const rows = wrapper.findAll(".editor-user-row");
    // u1 is the logged-in admin (provideUser("admin") uses id "u1").
    expect(rows[0].findAll(".editor-user-row-actions button")).toHaveLength(1);
    expect(rows[0].text()).not.toContain("Remove");
    expect(rows[1].findAll(".editor-user-row-actions button").map((b) => b.text())).toEqual([
      "Resend password",
      "Remove",
    ]);
  });

  it("removes a user after confirming, and drops them from the list", async () => {
    const remove = vi.spyOn(api, "removeUser").mockResolvedValue({ ok: true });
    const wrapper = mount(UsersView, {
      global: { stubs: { EditorBar: true, ConfirmDialog: confirmDialogStub }, provide: provideUser("admin") },
    });
    await flushPromises();
    const rows = wrapper.findAll(".editor-user-row");
    await rows[1].findAll(".editor-user-row-actions button")[1].trigger("click");
    expect(wrapper.find("[data-confirm-dialog]").text()).toContain("u2");
    await wrapper.get("[data-confirm-yes]").trigger("click");
    expect(remove).toHaveBeenCalledWith("u2");
    await flushPromises();
    expect(wrapper.findAll(".editor-user-row")).toHaveLength(1);
    expect(toasts.some((t) => t.kind === "success" && t.message.includes("u2"))).toBe(true);
  });

  it("cancels without removing anyone", async () => {
    const remove = vi.spyOn(api, "removeUser").mockResolvedValue({ ok: true });
    const wrapper = mount(UsersView, {
      global: { stubs: { EditorBar: true, ConfirmDialog: confirmDialogStub }, provide: provideUser("admin") },
    });
    await flushPromises();
    const rows = wrapper.findAll(".editor-user-row");
    await rows[1].findAll(".editor-user-row-actions button")[1].trigger("click");
    await wrapper.get("[data-confirm-no]").trigger("click");
    expect(remove).not.toHaveBeenCalled();
    expect(wrapper.findAll(".editor-user-row")).toHaveLength(2);
  });

  it("reports an error if removal fails", async () => {
    vi.spyOn(api, "removeUser").mockRejectedValue(new Error("cannot remove your own account"));
    const wrapper = mount(UsersView, {
      global: { stubs: { EditorBar: true, ConfirmDialog: confirmDialogStub }, provide: provideUser("admin") },
    });
    await flushPromises();
    const rows = wrapper.findAll(".editor-user-row");
    await rows[1].findAll(".editor-user-row-actions button")[1].trigger("click");
    await wrapper.get("[data-confirm-yes]").trigger("click");
    await flushPromises();
    expect(toasts.some((t) => t.kind === "error" && t.message === "cannot remove your own account")).toBe(true);
    expect(wrapper.findAll(".editor-user-row")).toHaveLength(2);
  });
});
