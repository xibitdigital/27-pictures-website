import { describe, expect, it } from "vitest";
import { effectiveEnv, encryptUserKey, getUserKeyStatus, isUserKeyName, saveUserKey, USER_KEY_NAMES } from "./userKeys";
import type { Env } from "./types";

const ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="; // 32 raw bytes, base64

function fakeDb(row: Record<string, unknown> | null) {
  const updates: { sql: string; args: unknown[] }[] = [];
  return {
    updates,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              return row as T | null;
            },
            async run() {
              updates.push({ sql, args });
              return { success: true };
            },
          };
        },
      };
    },
  };
}

function env(partial: Partial<Env> & { DB: unknown }): Env {
  return partial as unknown as Env;
}

describe("isUserKeyName", () => {
  it("accepts every configurable key name", () => {
    for (const name of USER_KEY_NAMES) expect(isUserKeyName(name)).toBe(true);
  });

  it("rejects bflApiKey — BFL has no per-user proxying", () => {
    expect(isUserKeyName("bflApiKey")).toBe(false);
  });

  it("rejects unknown strings and non-strings", () => {
    expect(isUserKeyName("somethingElse")).toBe(false);
    expect(isUserKeyName(null)).toBe(false);
    expect(isUserKeyName(42)).toBe(false);
  });
});

describe("encrypt/decrypt round trip via effectiveEnv", () => {
  it("resolves a saved key back to plaintext, overriding only that env field", async () => {
    const db = fakeDb(null);
    const e = env({ DB: db as never, KEYS_ENCRYPTION_KEY: ENCRYPTION_KEY, COMFY_API_KEY: "shared-comfy-key" });
    await saveUserKey(e, "user-1", "comfyApiKey", "user-secret-key");
    expect(db.updates).toHaveLength(1);
    const stored = db.updates[0].args[0] as string;
    expect(stored).not.toContain("user-secret-key"); // encrypted, not plaintext

    const db2 = fakeDb({ comfy_api_key_enc: stored, replicate_api_token_enc: null, elevenlabs_api_key_enc: null });
    const e2 = env({ DB: db2 as never, KEYS_ENCRYPTION_KEY: ENCRYPTION_KEY, COMFY_API_KEY: "shared-comfy-key" });
    const resolved = await effectiveEnv(e2, "user-1");
    expect(resolved.COMFY_API_KEY).toBe("user-secret-key");
    expect(resolved).not.toBe(e2); // shallow copy made, original untouched
  });

  it("falls back to the shared secret when no key is saved", async () => {
    const db = fakeDb({ comfy_api_key_enc: null, replicate_api_token_enc: null, elevenlabs_api_key_enc: null });
    const e = env({ DB: db as never, KEYS_ENCRYPTION_KEY: ENCRYPTION_KEY, COMFY_API_KEY: "shared-comfy-key" });
    const resolved = await effectiveEnv(e, "user-1");
    expect(resolved).toBe(e); // no override needed — same object back
    expect(resolved.COMFY_API_KEY).toBe("shared-comfy-key");
  });

  it("falls back to the shared secret when the row can't be decrypted (wrong/missing encryption key)", async () => {
    const stored = await encryptUserKey(
      env({ DB: fakeDb(null) as never, KEYS_ENCRYPTION_KEY: ENCRYPTION_KEY }),
      "user-secret"
    );
    const db = fakeDb({ comfy_api_key_enc: stored, replicate_api_token_enc: null, elevenlabs_api_key_enc: null });
    // Different (or missing) encryption key at read time — must not throw, must not leak ciphertext.
    const e = env({ DB: db as never, KEYS_ENCRYPTION_KEY: undefined, COMFY_API_KEY: "shared-comfy-key" });
    const resolved = await effectiveEnv(e, "user-1");
    expect(resolved.COMFY_API_KEY).toBe("shared-comfy-key");
  });

  it("no userId short-circuits without touching the DB", async () => {
    const db = fakeDb(null);
    const e = env({ DB: db as never, COMFY_API_KEY: "shared" });
    const resolved = await effectiveEnv(e, null);
    expect(resolved).toBe(e);
  });
});

describe("getUserKeyStatus", () => {
  it("reports booleans only, never the encrypted value", async () => {
    const db = fakeDb({
      comfy_api_key_enc: "iv:cipher",
      replicate_api_token_enc: null,
      elevenlabs_api_key_enc: "iv:cipher2",
    });
    const e = env({ DB: db as never });
    const status = await getUserKeyStatus(e, "user-1");
    expect(status).toEqual({ comfyApiKey: true, replicateApiToken: false, elevenlabsApiKey: true });
  });
});

describe("saveUserKey", () => {
  it("clears the column when given null/empty", async () => {
    const db = fakeDb(null);
    const e = env({ DB: db as never, KEYS_ENCRYPTION_KEY: ENCRYPTION_KEY });
    await saveUserKey(e, "user-1", "replicateApiToken", "  ");
    expect(db.updates[0].args[0]).toBeNull();
  });

  it("throws when KEYS_ENCRYPTION_KEY isn't configured and a value is given", async () => {
    const db = fakeDb(null);
    const e = env({ DB: db as never });
    await expect(saveUserKey(e, "user-1", "replicateApiToken", "secret")).rejects.toThrow(
      "KEYS_ENCRYPTION_KEY is not configured"
    );
  });
});
