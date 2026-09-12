import type {
  BubbleRecord,
  CharacterJob,
  CharacterProvider,
  CreditsSnapshot,
  EditorUser,
  InviteUserInput,
  InviteUserResult,
  PageKind,
  RegionBorderStyle,
  RegionGeometry,
  RegionRecord,
  RegionShapeType,
  RunComfyModel,
  RunComfyModelCategory,
  SeriesCharacter,
  SeriesInput,
  SeriesOption,
  ToonAsset,
  ToonAssetSource,
  ToonListItem,
  ToonMetaInput,
  ToonRecord,
  UserKeyName,
  UserKeyStatus,
} from "./types";

const TOKEN_KEY = "toon-editor-token";

export type { EditorUser } from "./types";

export interface AuthPayload {
  token: string;
  user: EditorUser;
}

/** Vite-dev proxy prefix — same origin, so login is not a CORS fetch. */
export const DEV_EDITOR_API = "/__editor-api";

/** Deployed Worker origin (also in `public/_headers` connect-src). */
export const DEFAULT_EDITOR_API = "https://toon-editor.sangalli-marco.workers.dev";

const REACH_ERROR =
  "Can't reach the editor API. In local dev run `make editor-worker` in another terminal, then reload.";

export function editorApiBase(): string | null {
  const raw = (import.meta.env.VITE_EDITOR_API as string | undefined)?.trim();
  if (raw) return raw.replace(/\/$/, "");
  // Unit tests run with DEV=true; don't pretend the proxy exists there.
  if (import.meta.env.DEV && !import.meta.env.VITEST) return DEV_EDITOR_API;
  if (import.meta.env.VITEST) return null;
  // Staging and production Pages share the deployed Worker (and its D1).
  return DEFAULT_EDITOR_API;
}

/** Tell the Worker which site is asking, so staging hosts see staging + public toons. */
export function withSiteQuery(url: string, origin?: string): string {
  const site = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!site || site === "null") return url;
  if (/[?&]site=/.test(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}site=${encodeURIComponent(site)}`;
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
    const err = body as { error?: string } | null;
    if (err?.error) throw new Error(err.error);
    if (res.status >= 500) throw new Error(REACH_ERROR);
    throw new Error(`editor api ${res.status}`);
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

export function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  return api<InviteUserResult>("/auth/users", { method: "POST", body: JSON.stringify(input) });
}

export async function listUsers(): Promise<EditorUser[]> {
  const body = await api<{ users?: EditorUser[] }>("/users");
  return Array.isArray(body.users) ? body.users : [];
}

/** Admin-only: regenerates this user's password and emails it to them. Same response shape as an invite. */
export function resendPassword(userId: string): Promise<InviteUserResult> {
  return api<InviteUserResult>(`/users/${userId}/resend-password`, { method: "POST" });
}

/** Admin-only: removes an account (and its series-editor memberships). The Worker refuses to remove the caller's own account. */
export function removeUser(userId: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/users/${userId}`, { method: "DELETE" });
}

export function fetchCredits(): Promise<CreditsSnapshot> {
  return api<CreditsSnapshot>("/credits");
}

/** Real, currently-available RunComfy models from its own catalog — not a hand-curated list like
 * RUNWARE_MODELS. Defaults to the image-to-image list (the existing page-generate picker);
 * the character generator asks for "text-to-image" instead. */
export function listRunComfyModels(category?: RunComfyModelCategory): Promise<RunComfyModel[]> {
  return api<RunComfyModel[]>(`/runcomfy/models${category ? `?category=${category}` : ""}`);
}

export function getUserKeys(): Promise<UserKeyStatus> {
  return api<UserKeyStatus>("/auth/keys");
}

/** `value` empty/null clears the key back to the shared Worker secret. */
export function saveUserKey(name: UserKeyName, value: string | null): Promise<UserKeyStatus> {
  return api<UserKeyStatus>("/auth/keys", { method: "PUT", body: JSON.stringify({ name, value }) });
}

export async function logout(): Promise<void> {
  try {
    await api<{ ok: boolean }>("/auth/logout", { method: "POST" });
  } catch {
    /* session already gone */
  }
  clearToken();
}

/** `limit` scopes to the current user exactly like the unlimited call (an editor sees only
 * their own; an admin sees everything) — it just caps and orders by most-recently-changed,
 * for the list view's "Recently changed" row. */
export function listToons(opts?: { limit?: number }): Promise<ToonListItem[]> {
  return api<ToonListItem[]>(opts?.limit ? `/toons?limit=${opts.limit}` : "/toons");
}

export async function listSeries(): Promise<SeriesOption[]> {
  const body = await api<{ series?: SeriesOption[] }>("/series");
  return Array.isArray(body.series) ? body.series : [];
}

export function getSeries(key: string): Promise<{ series: SeriesOption; toons: ToonListItem[] }> {
  return api<{ series: SeriesOption; toons: ToonListItem[] }>(`/series/${key}`);
}

export function saveSeries(input: SeriesInput): Promise<SeriesOption> {
  return api<SeriesOption>("/series", { method: "PUT", body: JSON.stringify(input) });
}

export function uploadSeriesCover(
  key: string,
  file: File,
  size?: { width: number; height: number }
): Promise<SeriesOption> {
  const body = new FormData();
  body.set("file", file);
  if (size) {
    body.set("width", String(size.width));
    body.set("height", String(size.height));
  }
  return api<SeriesOption>(`/series/${key}/cover`, { method: "POST", body });
}

export function uploadSeriesFlow(key: string, file: File): Promise<SeriesOption> {
  const body = new FormData();
  body.set("file", file);
  return api<SeriesOption>(`/series/${key}/flow`, { method: "POST", body });
}

export function uploadSeriesRef(key: string, alias: string, file: File): Promise<SeriesOption> {
  const body = new FormData();
  body.set("alias", alias);
  body.set("file", file);
  return api<SeriesOption>(`/series/${key}/refs`, { method: "POST", body });
}

/** Kicks off a text-to-image character generation for one reference slot — Runware/RunComfy only. */
export function generateCharacter(
  seriesKey: string,
  payload: { prompt: string; slotAlias: string; provider: CharacterProvider; model: string }
): Promise<CharacterJob> {
  return api<CharacterJob>(`/series/${seriesKey}/characters/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Poll result also carries `series`/`character` once the job is done — the slot is already
 * assigned server-side by then, same as `uploadSeriesRef`'s response. */
export function getCharacterJob(
  seriesKey: string,
  jobId: string
): Promise<CharacterJob & { series?: SeriesOption; character?: SeriesCharacter }> {
  return api(`/series/${seriesKey}/characters/jobs/${jobId}`);
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

export type CaptionTranslations = { it: string; de: string; fr: string };

export function translateFromEnglish(text: string): Promise<CaptionTranslations> {
  return api<CaptionTranslations>("/translate", { method: "POST", body: JSON.stringify({ text }) });
}

export function generatePage(
  id: string,
  payload: {
    prompt: string;
    includePrevious: boolean;
    pageId?: string | null;
    previousPageId?: string | null;
    /** One shape's own image inside a layout page, used instead of a whole plate. Wins over `previousPageId` when both are set. */
    previousRegionId?: string | null;
    previousFile?: File | null;
    count?: number;
    /** Flux only — sheet aliases to leave out of this one call (e.g. a doll ref that isn't in this shot). Ignored by the Comfy path, whose graph nodes are fixed. */
    excludeAliases?: string[];
  }
): Promise<{ id: string; status: string; comfyPromptId?: string | null }> {
  const body = new FormData();
  body.set("prompt", payload.prompt);
  body.set("includePrevious", payload.includePrevious ? "1" : "0");
  if (payload.pageId) body.set("pageId", payload.pageId);
  if (payload.previousPageId) body.set("previousPageId", payload.previousPageId);
  if (payload.previousRegionId) body.set("previousRegionId", payload.previousRegionId);
  if (payload.previousFile) body.set("previousFile", payload.previousFile);
  if (payload.count && payload.count > 1) body.set("count", String(payload.count));
  if (payload.excludeAliases?.length) body.set("excludeAliases", JSON.stringify(payload.excludeAliases));
  return api(`/toons/${id}/pages/generate`, { method: "POST", body });
}

export function getJob(id: string): Promise<{
  id: string;
  status: string;
  error?: string | null;
  resultPageId?: string | null;
  toon?: ToonRecord;
  comfyStatus?: "queued" | "running" | "done" | "error" | null;
  message?: string;
}> {
  return api(`/jobs/${id}`);
}

export function uploadPage(
  id: string,
  file: File,
  size?: { width: number; height: number },
  opts?: { kind?: PageKind }
): Promise<ToonRecord> {
  const body = new FormData();
  body.set("file", file);
  if (size) {
    body.set("width", String(size.width));
    body.set("height", String(size.height));
  }
  if (opts?.kind) body.set("kind", opts.kind);
  return api<ToonRecord>(`/toons/${id}/pages`, { method: "POST", body });
}

/** Swap the plate on an existing page. Captions stay; the file is a new hashed key. */
export function replacePage(pageId: string, file: File, size?: { width: number; height: number }): Promise<ToonRecord> {
  const body = new FormData();
  body.set("file", file);
  if (size) {
    body.set("width", String(size.width));
    body.set("height", String(size.height));
  }
  return api<ToonRecord>(`/pages/${pageId}/file`, { method: "POST", body });
}

/** Every image ever generated or uploaded for this toon — including ones no page or region uses
 * any more — newest first. `source` scopes to area/shape fills ("region") or whole plates
 * ("page"); omit for everything. */
export function listToonAssets(toonId: string, source?: ToonAssetSource): Promise<ToonAsset[]> {
  return api<ToonAsset[]>(`/toons/${toonId}/assets${source ? `?source=${source}` : ""}`);
}

/** Reuses an existing gallery asset as this page's plate instead of uploading it again. */
export function setPageFileFromAsset(pageId: string, fileKey: string): Promise<ToonRecord> {
  return api<ToonRecord>(`/pages/${pageId}/file-from-asset`, { method: "POST", body: JSON.stringify({ fileKey }) });
}

export interface AudioUpload {
  key: string;
  url: string;
  audio: string;
}

export function uploadAudio(id: string, file: File): Promise<AudioUpload> {
  const body = new FormData();
  body.set("file", file);
  return api<AudioUpload>(`/toons/${id}/audio`, { method: "POST", body });
}

export function generateAudio(
  id: string,
  payload: { text: string; voice: string; model?: string; stability?: number }
): Promise<AudioUpload> {
  return api<AudioUpload>(`/toons/${id}/audio/generate`, { method: "POST", body: JSON.stringify(payload) });
}

export function deletePage(pageId: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/pages/${pageId}`, { method: "DELETE" });
}

/** `order` must list every page in the toon exactly once, by id, in the desired position order. */
export function reorderPages(toonId: string, order: string[]): Promise<ToonRecord> {
  return api<ToonRecord>(`/toons/${toonId}/pages/reorder`, { method: "PATCH", body: JSON.stringify({ order }) });
}

export function addBubble(
  pageId: string,
  payload: { x: number; y: number; variant?: string; tail?: string; textEn?: string; size?: number }
): Promise<BubbleRecord> {
  return api<BubbleRecord>(`/pages/${pageId}/bubbles`, { method: "POST", body: JSON.stringify(payload) });
}

export function patchBubble(id: string, payload: Partial<BubbleRecord>): Promise<BubbleRecord> {
  return api<BubbleRecord>(`/bubbles/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteBubble(id: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/bubbles/${id}`, { method: "DELETE" });
}

/** Editor-set backdrop color, shown through any gap between regions. Pass null to clear back to the default. */
export function patchPageBgColor(pageId: string, bgColor: string | null): Promise<ToonRecord> {
  return api<ToonRecord>(`/pages/${pageId}`, { method: "PATCH", body: JSON.stringify({ bgColor }) });
}

export function addRegion(
  pageId: string,
  payload: { shapeType: RegionShapeType; geometry: RegionGeometry }
): Promise<RegionRecord> {
  return api<RegionRecord>(`/pages/${pageId}/regions`, { method: "POST", body: JSON.stringify(payload) });
}

export function patchRegion(
  id: string,
  payload: Partial<{
    geometry: RegionGeometry;
    imageOffsetX: number;
    imageOffsetY: number;
    imageScale: number;
    borderColor: string | null;
    borderWidth: number;
    borderStyle: RegionBorderStyle;
    sort: number;
  }>
): Promise<RegionRecord> {
  return api<RegionRecord>(`/regions/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteRegion(id: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/regions/${id}`, { method: "DELETE" });
}

export function uploadRegionImage(
  id: string,
  file: File,
  size?: { width: number; height: number }
): Promise<RegionRecord> {
  const body = new FormData();
  body.set("file", file);
  if (size) {
    body.set("width", String(size.width));
    body.set("height", String(size.height));
  }
  return api<RegionRecord>(`/regions/${id}/file`, { method: "POST", body });
}

/** Reuses an existing gallery asset to fill this region instead of uploading it again. */
export function setRegionFileFromAsset(regionId: string, fileKey: string): Promise<RegionRecord> {
  return api<RegionRecord>(`/regions/${regionId}/file-from-asset`, {
    method: "POST",
    body: JSON.stringify({ fileKey }),
  });
}

export function generateRegionImage(
  id: string,
  payload: {
    prompt: string;
    includePrevious: boolean;
    previousPageId?: string | null;
    /** One shape's own image inside a layout page, used instead of a whole plate. Wins over `previousPageId` when both are set. */
    previousRegionId?: string | null;
    previousFile?: File | null;
    /** Flux only — sheet aliases to leave out of this one call (e.g. a doll ref that isn't in this shot). Ignored by the Comfy path, whose graph nodes are fixed. */
    excludeAliases?: string[];
  }
): Promise<{ id: string; status: string; comfyPromptId?: string | null }> {
  const body = new FormData();
  body.set("prompt", payload.prompt);
  body.set("includePrevious", payload.includePrevious ? "1" : "0");
  if (payload.previousPageId) body.set("previousPageId", payload.previousPageId);
  if (payload.previousRegionId) body.set("previousRegionId", payload.previousRegionId);
  if (payload.previousFile) body.set("previousFile", payload.previousFile);
  if (payload.excludeAliases?.length) body.set("excludeAliases", JSON.stringify(payload.excludeAliases));
  return api(`/regions/${id}/generate`, { method: "POST", body });
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
