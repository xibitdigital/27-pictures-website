import type { EpisodeNav } from "../series";

/** Shared types for FlipFrame / toon readers. */

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
   * vertical-scroll mode (see ToonReaderShell + createConfigLoader).
   */
  pages?: string[];
  /** Async page source; used when `pages` is not set. Default: loadConfigPages. */
  getPages?: () => Promise<string[]>;
  /** Only used when neither `pages` nor `getPages` is set. Default: config.json */
  configUrl?: string;
  /** @deprecated Use configUrl */
  manifestUrl?: string;
  backHref?: string;
  backLabel?: string;
  /** Series navigation on the back cover (see src/toons/series.ts). */
  backNav?: EpisodeNav | null;
  frontCoverLogo?: string | null;
  coverTitle?: string;
  coverSubtitle?: import("./flipframeCopy").LocalizedString | null;
  /**
   * Optional story synopsis on the front cover (above FlipFrame / how-to icons).
   * Plain text or a map of locale → text; use `\n\n` for paragraphs.
   */
  coverSynopsis?: import("./flipframeCopy").LocalizedString | null;
  soundHint?: string | null;
  /** Current sound state when (re)painting the front-cover sound button. */
  getSoundEnabled?: () => boolean;
  /** Front-cover sound button click (no querySelector needed later). */
  onSoundToggle?: () => void;
  coverTexture?: string | null;
  /**
   * Fired when the user successfully turns a page (next/prev), after bounds
   * checks pass. Not fired for the initial paint or programmatic repaints.
   */
  onPageTurn?: (delta: number) => void;
  beforeStart?: () => void | Promise<void>;
  /**
   * 1-based content page to open on start (overrides `?page=` when set).
   * Useful for tests; production usually relies on the URL query.
   */
  initialPage?: number;
}

/**
 * Book options a toon app may pass into ToonReaderShell.
 * Page source + cover identity are owned by the shell — not overridable here.
 */
export type ToonShellBookOptions = Omit<
  ToonBookOptions,
  "altPrefix" | "frontCoverLogo" | "coverTexture" | "pages" | "getPages" | "configUrl" | "manifestUrl"
>;

/** Minimal shell surface for parent apps (sound cover re-paint, re-layout). */
export interface ToonReaderShellExpose {
  /** Force the book view to re-render (captions re-measure themselves). */
  refreshCaptions: () => void;
  /** Re-render the current book view (e.g. front-cover sound button state). */
  repaintCover: () => void;
}

export interface ToonBookApi {
  turn: (delta: number) => void;
  goNext: () => void;
  goPrev: () => void;
  /** Jump to a 1-based content page (clamped). */
  goToPage: (pageNum: number) => void;
  updateView: (skipRender?: boolean) => void;
  getViewIndex: () => number;
  getPages: () => string[];
  /** Tear down document-level listeners (call on unmount). */
  destroy: () => void;
}

/** One page in config.json — image + optional caption overlays. */
export interface ToonPage {
  /** Relative image path (e.g. `assets/<hash>.jpg`). */
  file: string;
  /**
   * Place reverb for every clip on this page. Overrides book `reverb`.
   * Types: `scripts/reverb-types.json`. `"none"` skips. The reader ignores this.
   */
  reverb?: string;
  /** Caption / SFX entries for this page. */
  words?: WordEntry[];
}

/**
 * Unified toon config (public/toons/<name>/config.json).
 * Ordered `pages[]` is the source of truth for images + captions.
 */
export interface ToonConfig {
  title?: string;
  designWidth?: number;
  designHeight?: number;
  defaultLang?: LangCode;
  languages?: LangOption[];
  fontFamily?: string;
  /**
   * Default place reverb for generated clips (`plaza`, `plaza-deep`, …).
   * Page / word `reverb` overrides. Baked into the mp3; the reader ignores this.
   */
  reverb?: string;
  /** Ordered pages: each has `file` + optional `words`. */
  pages?: ToonPage[];
}

/** @deprecated Use ToonConfig */
export type ToonManifest = ToonConfig;

/** Injected into WordOverlay so caption SFX never reads window globals. */
export interface SoundGate {
  isEnabled: () => boolean;
  /** Called when the user taps a caption while sound is off (show enable prompt once). */
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
  /**
   * Opacity of the bubble body fill only (0–1). Stroke and caption text stay solid.
   * e.g. `0.8` = 80% white body.
   */
  opacity?: number;
  /** Alias for strokeWidth (balloon outline thickness). */
  strokeThickness?: number;
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
  /** Legacy alias for `bubble.opacity` (fill only, 0–1 or 0–100). */
  bubbleOpacity?: number;
  fontFamily?: string;
  /**
   * Locked speaker for TTS. Must be a key in `scripts/voices.json`
   * (`erin`, `venus`, `goblinking`, …) — not the ElevenLabs UUID.
   * Omit on onomatopoeia / SFX. The reader ignores this; generators use it.
   */
  voice?: string;
  /**
   * Place reverb type for this clip (`plaza`, `plaza-deep`, or `"none"` to skip
   * a book/page default). Generators apply it after TTS; the reader ignores it.
   */
  reverb?: string;
  audio?: string;
  /** Playback gain 0–1 for `audio` (default 1). Louder needs a hotter source file. */
  volume?: number;
  text?: WordTextMap | string;
}

/** Caption-relevant slice of ToonConfig (same object; alias for WordOverlay). */
export type WordsConfig = ToonConfig;

export interface WordOverlayOptions {
  sound?: SoundGate;
  /** localStorage key for language; default keeps legacy Jax key. */
  langStorageKey?: string;
  /** Auto-read a page's SFX captions in order once the page is on screen. Default true. */
  autoRead?: boolean;
  /** Silence between auto-read clips, in ms. Default 2000. */
  autoReadGapMs?: number;
}
