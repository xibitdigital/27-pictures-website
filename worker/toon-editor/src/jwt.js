/**
 * Compact HS256 JWTs for the editor Worker (Web Crypto, no npm jose).
 * Rejects alg=none and unsigned tokens. Secret must be ≥ 32 characters.
 */

const MIN_SECRET = 32;

function b64urlEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const padded = String(str || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(str) {
  return new TextEncoder().encode(str);
}

function utf8Json(obj) {
  return utf8(JSON.stringify(obj));
}

export function requireJwtSecret(env) {
  const secret = String((env && env.JWT_SECRET) || "").trim();
  if (secret.length < MIN_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", utf8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signJwt(payload, secret) {
  if (String(secret || "").length < MIN_SECRET) throw new Error("JWT_SECRET is not configured");
  const header = b64urlEncode(utf8Json({ alg: "HS256", typ: "JWT" }));
  const body = b64urlEncode(utf8Json(payload));
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, utf8(data));
  return `${data}.${b64urlEncode(sig)}`;
}

export async function verifyJwt(token, secret) {
  if (String(secret || "").length < MIN_SECRET) return null;
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
  } catch {
    return null;
  }
  if (!header || header.alg !== "HS256") return null;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(parts[2]), utf8(`${parts[0]}.${parts[1]}`));
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
  return payload;
}
