/**
 * Per-user API keys (Flux/Replicate/Comfy/ElevenLabs), encrypted at rest with
 * AES-GCM and a Wrangler secret (`KEYS_ENCRYPTION_KEY`, base64 32 bytes) —
 * unlike account passwords (`auth.ts`, one-way PBKDF2), these must be
 * reversible so they can actually reach the provider APIs. A user with no
 * key saved for a given provider keeps working off the shared Worker secret
 * (`BFL_API_KEY` etc.) — see `effectiveEnv`.
 */

import { USER_KEY_NAMES, type UserKeyName } from "./apiTypes";
import type { Env } from "./types";

export type { UserKeyName } from "./apiTypes";
export { USER_KEY_NAMES } from "./apiTypes";

type EnvSecretKey = "REPLICATE_API_TOKEN" | "COMFY_API_KEY" | "ELEVENLABS_API_KEY" | "RUNWARE_API_KEY";

const USER_KEY_FIELDS: Record<UserKeyName, { column: string; envKey: EnvSecretKey }> = {
  replicateApiToken: { column: "replicate_api_token_enc", envKey: "REPLICATE_API_TOKEN" },
  comfyApiKey: { column: "comfy_api_key_enc", envKey: "COMFY_API_KEY" },
  elevenlabsApiKey: { column: "elevenlabs_api_key_enc", envKey: "ELEVENLABS_API_KEY" },
  runwareApiToken: { column: "runware_api_token_enc", envKey: "RUNWARE_API_KEY" },
};

export function isUserKeyName(name: unknown): name is UserKeyName {
  return typeof name === "string" && (USER_KEY_NAMES as readonly string[]).includes(name);
}

/** Trim, unwrap quotes, drop a leading `Bearer`/`Token` — people paste the curl header. */
export function normaliseUserSecret(value: string): string {
  let s = value.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/^(Bearer|Token)\s+/i, "").trim();
}

function overlaySecrets(env: Env, secrets: Partial<Record<EnvSecretKey, string>>): Env {
  return new Proxy(env, {
    get(target, prop) {
      if (typeof prop === "string" && Object.prototype.hasOwnProperty.call(secrets, prop)) {
        return secrets[prop as EnvSecretKey];
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Env;
}

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decode(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesKey(env: Env): Promise<CryptoKey | null> {
  const raw = String(env.KEYS_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  let bytes: Uint8Array;
  try {
    bytes = b64decode(raw);
  } catch {
    return null;
  }
  if (bytes.length !== 32) return null; // AES-256-GCM
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** `iv:ciphertext`, both base64. Throws if `KEYS_ENCRYPTION_KEY` isn't configured — callers only reach this from the explicit "save a key" route, where failing loud is correct. */
export async function encryptUserKey(env: Env, plaintext: string): Promise<string> {
  const key = await aesKey(env);
  if (!key) throw new Error("KEYS_ENCRYPTION_KEY is not configured");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `${b64encode(iv)}:${b64encode(new Uint8Array(ciphertext))}`;
}

/** Never throws — a missing encryption key, corrupted row, or wrong key all just miss, so callers fall back to the shared Worker secret instead of failing a generation over key management. */
async function decryptUserKey(env: Env, stored: string): Promise<string | null> {
  const key = await aesKey(env);
  if (!key) return null;
  const [ivPart, dataPart] = stored.split(":");
  if (!ivPart || !dataPart) return null;
  try {
    const iv = b64decode(ivPart);
    const data = b64decode(dataPart);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

type UserKeyRow = Record<string, string | null>;

const SELECT_COLUMNS = USER_KEY_NAMES.map((name) => USER_KEY_FIELDS[name].column).join(", ");

/** Which keys this user has set — booleans only, values never leave the Worker. */
export async function getUserKeyStatus(env: Env, userId: string): Promise<Record<UserKeyName, boolean>> {
  const row = await env.DB.prepare(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = ?`).bind(userId).first<UserKeyRow>();
  const status = {} as Record<UserKeyName, boolean>;
  for (const name of USER_KEY_NAMES) {
    status[name] = Boolean(row && row[USER_KEY_FIELDS[name].column]);
  }
  return status;
}

/** `value` null/empty clears the key back to "use the shared secret". */
export async function saveUserKey(env: Env, userId: string, name: UserKeyName, value: string | null): Promise<void> {
  const { column } = USER_KEY_FIELDS[name];
  const trimmed = value == null ? null : normaliseUserSecret(value) || null;
  const stored = trimmed ? await encryptUserKey(env, trimmed) : null;
  await env.DB.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).bind(stored, userId).run();
}

/**
 * Resolves `userId`'s saved keys once at the request edge into a shallow
 * copy of `env`, so every downstream client (fluxClient.ts, replicateClient.ts,
 * comfyClient.ts, elevenlabs.ts) keeps reading `env.BFL_API_KEY` etc. exactly
 * as it does today — zero changes needed in those modules. A key that isn't
 * set, or fails to decrypt, is simply left off the copy (falls back to the
 * shared Worker secret already on `env`).
 */
export async function effectiveEnv(env: Env, userId: string | null | undefined): Promise<Env> {
  if (!userId) return env;
  const row = await env.DB.prepare(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = ?`).bind(userId).first<UserKeyRow>();
  if (!row) return env;
  const secrets: Partial<Record<EnvSecretKey, string>> = {};
  let any = false;
  for (const name of USER_KEY_NAMES) {
    const { column, envKey } = USER_KEY_FIELDS[name];
    const stored = row[column];
    if (!stored) continue;
    any = true;
    const plain = await decryptUserKey(env, stored);
    // Fail closed: a stored key that won't decrypt must not silently use the shared Worker secret
    // (Settings still shows "Set", and a stale shared Replicate token then 401s).
    secrets[envKey] = plain ? normaliseUserSecret(plain) : "";
  }
  return any ? overlaySecrets(env, secrets) : env;
}
