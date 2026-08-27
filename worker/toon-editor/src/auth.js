/**
 * Editor accounts: PBKDF2 password hashes + HS256 JWTs.
 * Login returns a signed Bearer token; protected routes verify it with JWT_SECRET.
 */

import { requireJwtSecret, signJwt, verifyJwt } from "./jwt.js";

const PBKDF2_ITERATIONS = 100000;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unhex(str) {
  const clean = String(str || "");
  if (clean.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export function normaliseEmail(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

export function validateCredentials(email, password) {
  if (!EMAIL_RE.test(email) || email.length > 254) return "invalid email";
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return "password must be at least 8 characters";
  }
  return null;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${hex(salt)}:${hex(hash)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || "").split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const salt = unhex(parts[2]);
  const expected = unhex(parts[3]);
  if (!salt.length || expected.length !== 32) return false;
  const actual = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

export async function issueToken(env, user) {
  const secret = requireJwtSecret(env);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_MS / 1000;
  const token = await signJwt(
    {
      sub: user.id,
      email: user.email,
      iat: now,
      exp,
    },
    secret
  );
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export async function userFromRequest(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const payload = await verifyJwt(match[1], requireJwtSecret(env));
  if (!payload || !payload.sub) return null;
  const row = await env.DB.prepare("SELECT id, email FROM users WHERE id = ?").bind(payload.sub).first();
  if (!row) return null;
  return { id: row.id, email: row.email };
}

export async function userCount(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
  return Number(row && row.n) || 0;
}

export function publicUser(user) {
  return { id: user.id, email: user.email };
}
