import { describe, expect, it, vi } from "vitest";
import worker from "./index";
import { signJwt } from "./jwt";
import type { Env, UserRow } from "./types";

const SECRET = "a".repeat(32);

const sendPasswordResetEmail = vi.fn().mockResolvedValue(true);
vi.mock("./inviteEmail", () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));

const admin: UserRow = { id: "admin1", email: "admin@example.com", username: "admin", role: "admin" };
const editor: UserRow = { id: "u1", email: "editor@example.com", username: "editor1", role: "editor" };

interface FakeState {
  users: UserRow[];
  seriesEditors?: { series_key: string; user_id: string }[];
}

function makeEnv(state: FakeState): Env {
  return {
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: "https://twentyseven.pictures",
    RESEND_API_KEY: "key",
    FROM_EMAIL: "noreply@example.com",
    DB: {
      prepare(sql: string) {
        const stmt = {
          args: [] as unknown[],
          bind(...args: unknown[]) {
            stmt.args = args;
            return stmt;
          },
          async first<T>() {
            if (/FROM users WHERE id = \?/.test(sql)) {
              return (state.users.find((u) => u.id === stmt.args[0]) || null) as unknown as T;
            }
            return null;
          },
          async run() {
            if (/UPDATE users SET password_hash = \? WHERE id = \?/.test(sql)) {
              const [, id] = stmt.args as [string, string];
              const user = state.users.find((u) => u.id === id);
              if (user) user.password_hash = String(stmt.args[0]);
            }
            if (/DELETE FROM series_editors WHERE user_id = \?/.test(sql)) {
              const [id] = stmt.args as [string];
              state.seriesEditors = (state.seriesEditors || []).filter((e) => e.user_id !== id);
            }
            if (/DELETE FROM users WHERE id = \?/.test(sql)) {
              const [id] = stmt.args as [string];
              state.users = state.users.filter((u) => u.id !== id);
            }
            return {};
          },
          async all() {
            return { results: [] };
          },
        };
        return stmt;
      },
    },
  } as unknown as Env;
}

async function authedRequest(url: string, userId: string, init: RequestInit = {}): Promise<Request> {
  const token = await signJwt({ sub: userId, email: "x@example.com", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return new Request(url, { ...init, headers });
}

describe("POST /users/:id/resend-password", () => {
  it("regenerates the password, emails it, and never echoes it back", async () => {
    sendPasswordResetEmail.mockClear();
    const state: FakeState = { users: [admin, { ...editor, password_hash: "pbkdf2:1:aa:bb" }] };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/users/u1/resend-password", admin.id, { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string; email: string }; emailSent: boolean };
    expect(body.user).toEqual({ id: "u1", email: "editor@example.com", username: "editor1", role: "editor" });
    expect(body.emailSent).toBe(true);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body)).not.toContain("pbkdf2");
    // The stored hash actually changed (a new password was generated).
    expect(state.users[1].password_hash).not.toBe("pbkdf2:1:aa:bb");
  });

  it("403s for a non-admin caller", async () => {
    const state: FakeState = { users: [admin, editor] };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/users/admin1/resend-password", editor.id, { method: "POST" }),
      env
    );
    expect(res.status).toBe(403);
  });

  it("404s for a user that does not exist", async () => {
    const state: FakeState = { users: [admin] };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/users/missing/resend-password", admin.id, { method: "POST" }),
      env
    );
    expect(res.status).toBe(404);
  });

  it("401s with no session at all", async () => {
    const state: FakeState = { users: [admin, editor] };
    const env = makeEnv(state);
    const res = await worker.fetch(
      new Request("https://toon-editor.example/users/u1/resend-password", { method: "POST" }),
      env
    );
    expect(res.status).toBe(401);
  });
});

describe("DELETE /users/:id", () => {
  it("removes the account and its series-editor memberships", async () => {
    const state: FakeState = {
      users: [admin, editor],
      seriesEditors: [
        { series_key: "erin", user_id: "u1" },
        { series_key: "jax", user_id: "admin1" },
      ],
    };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/users/u1", admin.id, { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(state.users.map((u) => u.id)).toEqual(["admin1"]);
    expect(state.seriesEditors).toEqual([{ series_key: "jax", user_id: "admin1" }]);
  });

  it("refuses to let an admin remove their own account", async () => {
    const state: FakeState = { users: [admin, editor] };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/users/admin1", admin.id, { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "cannot remove your own account" });
    expect(state.users).toHaveLength(2);
  });

  it("403s for a non-admin caller", async () => {
    const state: FakeState = { users: [admin, editor] };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/users/admin1", editor.id, { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(403);
    expect(state.users).toHaveLength(2);
  });

  it("404s for a user that does not exist", async () => {
    const state: FakeState = { users: [admin] };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/users/missing", admin.id, { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(404);
  });

  it("401s with no session at all", async () => {
    const state: FakeState = { users: [admin, editor] };
    const env = makeEnv(state);
    const res = await worker.fetch(new Request("https://toon-editor.example/users/u1", { method: "DELETE" }), env);
    expect(res.status).toBe(401);
  });
});
