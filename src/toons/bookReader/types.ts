/** Shared types for FlipFrame / toon readers. */

export type PagePaintHandler = (slot: HTMLElement, pageNum: number) => void;
export type PageClearHandler = (slot: HTMLElement) => void;

/**
 * DOM nodes the flip engine needs. Prefer Vue template refs over getElementById.
 */
export interface ToonBookEls {
  book: HTMLElement;
  slotLeft: HTMLElement;
  slotRight: HTMLElement;
  indicator: HTMLElement;
  btnPrev: HTMLButtonElement | HTMLElement;
  btnNext: HTMLButtonElement | HTMLElement;
  zoneNext?: HTMLElement | null;
  zonePrev?: HTMLElement | null;
  /** Optional chrome to pulse on first load (e.g. .toon-top-controls). */
  topControls?: HTMLElement | null;
}

export interface ToonBookOptions {
  altPrefix?: string;
  /**
   * Pre-resolved page URLs. Prefer `getPages` when sharing a single fetch with
   * vertical-scroll mode (see ToonReaderShell + createManifestLoader).
   */
  pages?: string[];
  /** Async page source; used when `pages` is not set. Default: loadManifest. */
  getPages?: () => Promise<string[]>;
  /** Only used when neither `pages` nor `getPages` is set. */
  manifestUrl?: string;
  backHref?: string;
  backLabel?: string;
  frontCoverLogo?: string | null;
  coverTitle?: string;
  coverSubtitle?: string | null;
  soundHint?: string | null;
  /** Current sound state when (re)painting the front-cover sound button. */
  getSoundEnabled?: () => boolean;
  /** Front-cover sound button click (no querySelector needed later). */
  onSoundToggle?: () => void;
  coverTexture?: string | null;
  onPagePaint?: PagePaintHandler;
  onPageClear?: PageClearHandler;
  /**
   * Fired when the user successfully turns a page (next/prev), after bounds
   * checks pass. Not fired for the initial paint or programmatic repaints.
   */
  onPageTurn?: (delta: number) => void;
  beforeStart?: () => void | Promise<void>;
}

/**
 * Book options a toon app may pass into ToonReaderShell.
 * Page source + cover identity are owned by the shell — not overridable here.
 */
export type ToonShellBookOptions = Omit<
  ToonBookOptions,
  "altPrefix" | "frontCoverLogo" | "coverTexture" | "pages" | "getPages" | "manifestUrl"
>;

/** Minimal shell surface for parent apps (lang switch, sound cover re-paint). */
export interface ToonReaderShellExpose {
  /** Re-paint captions on the active view (book slots or vertical strip). */
  refreshCaptions: () => void;
  /** Re-render the current book view (e.g. front-cover sound button state). */
  repaintCover: () => void;
}

export interface ToonBookApi {
  turn: (delta: number) => void;
  goNext: () => void;
  goPrev: () => void;
  updateView: (skipRender?: boolean) => void;
  getViewIndex: () => number;
  getPages: () => string[];
  /** Tear down document-level listeners (call on unmount). */
  destroy: () => void;
}

export interface ToonManifest {
  title?: string;
  pages?: number;
  files?: string[];
  pattern?: string;
  designWidth?: number;
  designHeight?: number;
}

/** Injected into WordOverlay so caption SFX never reads window globals. */
export interface SoundGate {
  isEnabled: () => boolean;
  /** Called when the user tries SFX while sound is off (e.g. show prompt once). */
  onBlockedPlay?: () => void;
}

export type LangCode = string;

export interface LangOption {
  code: LangCode;
  label: string;
}

export interface WordTextMap {
  en?: string;
  it?: string;
  de?: string;
  fr?: string;
  [code: string]: string | undefined;
}

export interface WordBubbleStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  tail?: string;
  padX?: number;
  padY?: number;
  shape?: string;
  retrace?: number;
  scratches?: number;
}

export interface WordEntry {
  x?: number;
  y?: number;
  align?: string;
  size?: number;
  color?: string;
  stroke?: string | { color?: string; strokeColor?: string; thickness?: number; width?: number };
  strokeColor?: string;
  strokeThickness?: number;
  strokeWidth?: number;
  maxWidth?: number;
  angle?: number;
  rotate?: number;
  scale?: number;
  variant?: string;
  mode?: string;
  tail?: string;
  bubble?: WordBubbleStyle;
  /** Legacy flat bubble keys (still accepted by resolveBubbleStyle). */
  bubbleShape?: string;
  bubbleFill?: string;
  bubbleStroke?: string;
  bubbleStrokeWidth?: number;
  fontFamily?: string;
  audio?: string;
  text?: WordTextMap | string;
}

export interface WordsConfig {
  designWidth?: number;
  designHeight?: number;
  pages?: Record<string, WordEntry[]>;
  languages?: LangOption[];
  defaultLang?: LangCode;
  fontFamily?: string;
}

export interface WordOverlayOptions {
  sound?: SoundGate;
  /** localStorage key for language; default keeps legacy Jax key. */
  langStorageKey?: string;
}
