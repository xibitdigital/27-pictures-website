import type { BubbleRecord, ToonListItem, ToonMetaInput, ToonRecord } from "./types";

const TOKEN_KEY = "toon-editor-token";

export interface EditorUser {
  id: string;
  email: string;
}

export interface AuthPayload {
  token: string;
  user: EditorUser;
}

/** Vite-dev proxy prefix — same origin, so login is not a CORS fetch. */
export const DEV_EDITOR_API = "/__editor-api";

const REACH_ERROR =
  "Can't reach the editor API. In local dev run `make editor-worker` in another terminal, then reload.";

export function editorApiBase(): string | null {
  const raw = (import.meta.env.VITE_EDITOR_API as string | undefined)?.trim();
  if (raw) return raw.replace(/\/$/, "");
  // Unit tests run with DEV=true; don't pretend the proxy exists there.
  if (import.meta.env.DEV && !import.meta.env.VITEST) return DEV_EDITOR_API;
  return null;
}

export function getToken(): string {
  if (typeof sessionStorage === "undefined") return "";
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const base = editorApiBase();
  if (!base) throw new Error("VITE_EDITOR_API is not set");
  const headers = new Headers(init.headers);
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch (err) {
    if (err instanceof TypeError) throw new Error(REACH_ERROR);
    throw err;
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }
  if (!res.ok) {
    if (res.status >= 500) throw new Error(REACH_ERROR);
    const err = body as { error?: string } | null;
    throw new Error(err?.error || `editor api ${res.status}`);
  }
  return body as T;
}

export function authStatus(): Promise<{ hasUsers: boolean }> {
  return api<{ hasUsers: boolean }>("/auth/status", {}, false);
}

export function login(email: string, password: string): Promise<AuthPayload> {
  return api<AuthPayload>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false);
}

export function register(email: string, password: string): Promise<AuthPayload> {
  return api<AuthPayload>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }, false);
}

export function fetchMe(): Promise<{ user: EditorUser }> {
  return api<{ user: EditorUser }>("/auth/me");
}

export async function logout(): Promise<void> {
  try {
    await api<{ ok: boolean }>("/auth/logout", { method: "POST" });
  } catch {
    /* session already gone */
  }
  clearToken();
}

export function listToons(): Promise<ToonListItem[]> {
  return api<ToonListItem[]>("/toons");
}

export function createToon(input: ToonMetaInput): Promise<ToonRecord> {
  return api<ToonRecord>("/toons", { method: "POST", body: JSON.stringify(input) });
}

export function getToon(id: string): Promise<ToonRecord> {
  return api<ToonRecord>(`/toons/${id}`);
}

export function patchToon(id: string, input: Partial<ToonMetaInput>): Promise<ToonRecord> {
  return api<ToonRecord>(`/toons/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function uploadCover(id: string, file: File, size?: { width: number; height: number }): Promise<ToonRecord> {
  const body = new FormData();
  body.set("file", file);
  if (size) {
    body.set("width", String(size.width));
    body.set("height", String(size.height));
  }
  return api<ToonRecord>(`/toons/${id}/cover`, { method: "POST", body });
}

export function uploadPage(id: string, file: File, size?: { width: number; height: number }): Promise<ToonRecord> {
  const body = new FormData();
  body.set("file", file);
  if (size) {
    body.set("width", String(size.width));
    body.set("height", String(size.height));
  }
  return api<ToonRecord>(`/toons/${id}/pages`, { method: "POST", body });
}

export function deletePage(pageId: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/pages/${pageId}`, { method: "DELETE" });
}

export function addBubble(
  pageId: string,
  payload: { x: number; y: number; variant?: string; tail?: string; textEn?: string }
): Promise<BubbleRecord> {
  return api<BubbleRecord>(`/pages/${pageId}/bubbles`, { method: "POST", body: JSON.stringify(payload) });
}

export function patchBubble(id: string, payload: Partial<BubbleRecord>): Promise<BubbleRecord> {
  return api<BubbleRecord>(`/bubbles/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteBubble(id: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/bubbles/${id}`, { method: "DELETE" });
}

export function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not read image"));
    };
    img.src = url;
  });
}
