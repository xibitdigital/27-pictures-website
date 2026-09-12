/**
 * JSON the toon-editor Worker returns and the Vue studio consumes.
 * No Cloudflare types — safe to import from the site bundle.
 */

export const DESC_LANGS = ["en", "it", "de", "fr"] as const;
export type CaptionLang = (typeof DESC_LANGS)[number];
export type DescriptionMap = Record<CaptionLang, string>;

export type ToonStatus = "draft" | "staging" | "published";

export type UserRole = "admin" | "editor";

export interface EditorUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
}

export interface CreditBucket {
  used: number;
  limit: number | null;
  unit: "chars" | "credits";
}

export interface CreditsSnapshot {
  audio: CreditBucket;
  image: CreditBucket;
  periodEnd: string | null;
}

export function emptyDescriptionMap(): DescriptionMap {
  return { en: "", it: "", de: "", fr: "" };
}

export function parseDescriptionMap(raw: unknown, fallbackEn = ""): DescriptionMap {
  const map = emptyDescriptionMap();
  map.en = fallbackEn;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    for (const lang of DESC_LANGS) {
      if (typeof rec[lang] === "string") map[lang] = rec[lang];
    }
  }
  if (!map.en.trim()) map.en = fallbackEn;
  return map;
}

export function pickDescription(map: DescriptionMap | undefined, lang: string, fallback = ""): string {
  if (!map) return fallback;
  const hit = map[lang as CaptionLang];
  return (hit && hit.trim()) || map.en.trim() || fallback;
}

export interface BubbleRecord {
  id: string;
  x: number;
  y: number;
  variant: string;
  tail: string | null;
  size: number | null;
  angle: number | null;
  textEn: string;
  textJson?: string | null;
  extraJson?: string | null;
  sort: number;
}

export type RegionShapeType = "rect" | "polygon";

export type RegionBorderStyle = "solid" | "dashed" | "dotted";

/** Plate-fraction coordinates (0-1). A rect is a constrained 4-point shape;
 * a polygon's vertices move independently. Both render through one
 * `clip-path: polygon(...)` code path client-side. */
export type RegionGeometry =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "polygon"; points: { x: number; y: number }[] };

/** One drawn mask on a `kind: "layout"` page. `fileKey`/`fileUrl` are null
 * until an image has been uploaded or generated for this shape.
 * `borderWidth: 0` (the default) means no border regardless of color/style. */
export interface RegionRecord {
  id: string;
  shapeType: RegionShapeType;
  geometry: RegionGeometry;
  fileKey: string | null;
  fileUrl: string | null;
  fileWidth: number | null;
  fileHeight: number | null;
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  borderColor: string | null;
  borderWidth: number;
  borderStyle: RegionBorderStyle;
  sort: number;
}

export type PageKind = "plate" | "layout";

export interface PageRecord {
  id: string;
  position: number;
  fileKey: string;
  fileUrl: string;
  width: number | null;
  height: number | null;
  /** "layout" pages compose `regions` into this same `fileKey` on every edit
   * (flattened client-side) — the reader only ever sees one plate per page. */
  kind: PageKind;
  /** Editor-set backdrop color, shown through any gap between regions. Null = default background. */
  bgColor: string | null;
  bubbles: BubbleRecord[];
  regions: RegionRecord[];
}

export interface ToonRecord {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  descriptions?: DescriptionMap;
  coverKey: string | null;
  coverUrl: string | null;
  designWidth: number;
  designHeight: number;
  status?: string;
  readerUrl?: string | null;
  assetPageDir?: string | null;
  seriesKey?: string | null;
  episodeN?: number | null;
  ownerId?: string | null;
  pages: PageRecord[];
}

export type SeriesSlotKind = "sheet" | "previous" | "style";

export interface SeriesFlowSlot {
  alias: string;
  label: string;
  kind: SeriesSlotKind;
  /** A "sheet" slot with no file doesn't block Generate, and its LoadImage node is left unwired. No effect on "previous" or "style" — those require a file (or are silently skipped, for "previous", if there is none). */
  optional?: boolean;
  fileKey?: string | null;
  fileUrl?: string | null;
  /** Seedream pin this LoadImage is wired to, e.g. `image_1`. */
  rendererInput?: string | null;
  /** Comfy LoadImage node id this slot writes to. */
  loadNodeId?: string | null;
}

/** One node input in the uploaded flow that could receive the page prompt. */
export interface PromptCandidate {
  nodeId: string;
  inputKey: string;
  label: string;
  preview: string;
}

export interface PromptTarget {
  nodeId: string;
  inputKey: string;
}

/**
 * 'flux' calls BFL directly (flux-2-pro). 'replicate-flux'/'replicate-seedream'
 * call the same models via Replicate instead — same reference-sheets pipeline,
 * different host/API shape (see replicateClient.ts). 'replicate-flux' (Flux
 * Kontext's multi-image variant) only accepts 2 reference images, not the
 * full sheet set — startReplicateGenerate picks the first 2 included refs.
 * 'runware' calls Runware's single `imageInference` endpoint (runwareClient.ts)
 * for whichever model the series' `generate.model` names — Runware hosts many
 * models behind one API shape, so the model id is series config, not a kind
 * this type enumerates. 'runcomfy' calls RunComfy's hosted model API
 * (runComfyClient.ts, `model-api.runcomfy.net` — NOT the Worker's own
 * self-hosted-ComfyUI `COMFY_URL`/`COMFY_API_KEY`, a different service that
 * happens to share a name; see runcomfyApiToken in UserKeyName) — async
 * submit/poll/result, `generate.model` is its `org/model` path
 * (e.g. `bytedance/seedream-5.0-pro`).
 */
export type GenerateProvider = "comfy" | "flux" | "replicate-flux" | "replicate-seedream" | "runware" | "runcomfy";

export const GENERATE_PROVIDERS: readonly GenerateProvider[] = [
  "comfy",
  "flux",
  "replicate-flux",
  "replicate-seedream",
  "runware",
  "runcomfy",
];

/**
 * Each Runware model's own documented width/height contract — verified
 * against its docs page, not assumed generic across the platform. The Flux
 * Kontext models (runware.ai/docs/models/bfl-flux-1-kontext-{pro,max}) only
 * accept one of a fixed set of 9 pairs, not arbitrary width/height — sending
 * anything else 400s. Seedream 5.0 Pro
 * (runware.ai/docs/models/bytedance-seedream-5-0-pro) instead documents a
 * continuous area/side range ("any combination accepted within these
 * bounds") with no divisibility requirement.
 */
export type RunwareDimensions =
  | { kind: "fixed"; pairs: readonly (readonly [number, number])[] }
  | { kind: "range"; minPixels: number; maxPixels: number; minSide: number; maxSide: number };

const FLUX_KONTEXT_DIMENSIONS: RunwareDimensions = {
  kind: "fixed",
  pairs: [
    [1568, 672],
    [1392, 752],
    [1184, 880],
    [1248, 832],
    [1024, 1024],
    [832, 1248],
    [880, 1184],
    [752, 1392],
    [672, 1568],
  ],
};

/**
 * Curated subset of Runware's model directory — the ones that take
 * `referenceImages` for this reference-sheets pipeline. Runware's full
 * catalog is huge and changes independently of this codebase; picking from
 * this list (series form) keeps `generate.model` a verified AIR id instead
 * of a free-text field someone can mistype. `maxReferenceImages` and
 * `dimensions` are each model's own documented limits — `runwareSubmit`
 * truncates/reshapes the request to fit them.
 */
export interface RunwareModel {
  id: string;
  label: string;
  maxReferenceImages: number;
  dimensions: RunwareDimensions;
}

export const RUNWARE_MODELS: readonly RunwareModel[] = [
  {
    id: "bfl:3@1",
    label: "Flux Kontext [pro] (via Runware, max 2 refs, fixed sizes)",
    maxReferenceImages: 2,
    dimensions: FLUX_KONTEXT_DIMENSIONS,
  },
  {
    id: "bfl:4@1",
    label: "Flux Kontext [max] (via Runware, max 2 refs, fixed sizes)",
    maxReferenceImages: 2,
    dimensions: FLUX_KONTEXT_DIMENSIONS,
  },
  {
    id: "bytedance:seedream@5.0-pro",
    label: "Seedream 5.0 Pro (via Runware, max 10 refs)",
    maxReferenceImages: 10,
    dimensions: { kind: "range", minPixels: 921600, maxPixels: 4624220, minSide: 256, maxSide: 16383 },
  },
];

/** One RunComfy catalog entry (`GET /runcomfy/models`, runComfyClient.ts's runComfyListModels) —
 * unlike RUNWARE_MODELS this isn't a hand-curated list, since RunComfy's own catalog endpoint can
 * be asked for the current, real set directly. */
export interface RunComfyModel {
  id: string;
  label: string;
}

/** RunComfy's own catalog `category` filter — the image-to-image list (existing page-generate
 * picker) and the text-to-image list (character generator) are genuinely different sets. */
export type RunComfyModelCategory = "image-to-image" | "text-to-image";

/**
 * Providers with a real text-to-image path for the series character generator (SeriesForm.vue's
 * per-slot "Generate" button). Flux/Replicate are edit-only models here (flux-2-pro's multi-ref
 * mode, Kontext, Seedream-4) with no verified prompt-only model id, so they're left out rather
 * than guessed at — see runComfyClient.ts/runwareClient.ts and generateCharacter.ts.
 */
export type CharacterProvider = Extract<GenerateProvider, "runware" | "runcomfy">;

/** One image ever generated for a series' character slots, kept even after the slot that used it
 * is reassigned — mirrors ToonAsset's own append-only gallery, keyed by series instead of toon. */
export interface SeriesCharacter {
  id: string;
  seriesKey: string;
  prompt: string;
  fileKey: string;
  fileUrl: string | null;
  width: number | null;
  height: number | null;
  provider: CharacterProvider;
  model: string;
  createdAt: string;
}

export type CharacterJobStatus = "running" | "done" | "error";

/** `GET /series/:key/characters/jobs/:jobId` — polled the same way a page's `generation_jobs` row
 * is, just scoped to a series slot instead of a toon page. */
export interface CharacterJob {
  id: string;
  seriesKey: string;
  slotAlias: string;
  provider: CharacterProvider;
  model: string;
  prompt: string;
  status: CharacterJobStatus;
  error?: string | null;
  fileKey?: string | null;
  fileUrl?: string | null;
  width?: number | null;
  height?: number | null;
  createdAt: string;
}

/** Any provider that skips the Comfy graph entirely and calls a hosted model directly with the prompt + reference sheets. */
export function isDirectProvider(provider: GenerateProvider | string | null | undefined): boolean {
  return provider != null && provider !== "comfy";
}

export interface SeriesGenerateConfig {
  width: number | null;
  height: number | null;
  model: string;
  provider: GenerateProvider;
  flowKey: string | null;
  flowUrl: string | null;
  slots: SeriesFlowSlot[];
  /** Every literal string input found in the flow — for the series form's picker. */
  promptCandidates: PromptCandidate[];
  /** Which one the typed prompt is written into. Null = legacy behaviour (every Seedream node's `prompt`). */
  promptTarget: PromptTarget | null;
}

export interface SeriesOption {
  key: string;
  title: string;
  tagline?: string;
  coverUrl?: string | null;
  hubUrl?: string | null;
  sort?: number;
  toonCount?: number;
  description?: string;
  descriptions?: DescriptionMap;
  coverKey?: string | null;
  generate?: SeriesGenerateConfig;
  ownerId?: string | null;
  editorIds?: string[];
}

export interface SeriesInput {
  key: string;
  title: string;
  tagline: string;
  description: string;
  descriptions?: DescriptionMap;
  hubUrl?: string | null;
  sort?: number;
  generate?: Partial<SeriesGenerateConfig> | null;
  /** Only honoured server-side when the caller is admin. */
  editorIds?: string[];
}

export interface ToonListItem {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  coverUrl: string | null;
  pageCount?: number;
  status?: string;
  readerUrl?: string | null;
  seriesKey?: string | null;
  episodeN?: number | null;
  ownerId?: string | null;
  updatedAt?: string | null;
}

/** Whether a toon_assets row is a whole plate ("page") or a shape/area fill ("region") — the
 * gallery filters on this so the region picker and the "Add page" picker each only see their own
 * kind. Canonical definition; toonAssets.ts (Worker) re-exports it. */
export type ToonAssetSource = "page" | "region";

/** One image ever generated or uploaded for a toon, kept in its gallery even after the page or
 * region that used it is deleted or its file replaced — see toonAssets.ts. */
export interface ToonAsset {
  id: string;
  fileKey: string;
  url: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface ToonMetaInput {
  slug?: string;
  title: string;
  subtitle: string;
  description: string;
  descriptions?: DescriptionMap;
  status?: ToonStatus;
  seriesKey?: string | null;
  episodeN?: number | null;
}

export interface InviteUserInput {
  username: string;
  email: string;
  role?: UserRole;
  turnstileToken: string;
}

export interface InviteUserResult {
  user: EditorUser;
  emailSent: boolean;
}

/**
 * Per-user API keys a signed-in user can set for themselves (Settings page,
 * `GET`/`PUT /auth/keys`), overriding the shared Worker secret for their own
 * generations — see `worker/toon-editor/src/userKeys.ts`. BFL (Flux direct)
 * has no per-user proxying and is being dropped from this editor soon
 * regardless, so it's not offered here.
 */
export type UserKeyName =
  | "replicateApiToken"
  | "comfyApiKey"
  | "elevenlabsApiKey"
  | "runwareApiToken"
  | "runcomfyApiToken";

export const USER_KEY_NAMES: readonly UserKeyName[] = [
  "replicateApiToken",
  "comfyApiKey",
  "elevenlabsApiKey",
  "runwareApiToken",
  "runcomfyApiToken",
];

export const USER_KEY_LABELS: Record<UserKeyName, string> = {
  replicateApiToken: "Replicate API token",
  comfyApiKey: "Comfy API key",
  elevenlabsApiKey: "ElevenLabs API key",
  runwareApiToken: "Runware API key",
  runcomfyApiToken: "RunComfy API key",
};

/** `GET /auth/keys` response — whether each key is set, values never included. */
export type UserKeyStatus = Record<UserKeyName, boolean>;
