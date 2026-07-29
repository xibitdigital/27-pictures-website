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
  beforeStart?: () => void | Promise<void>;
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

export interface ViewModeOptions {
  altPrefix?: string;
  manifestUrl?: string;
  btn?: string | HTMLElement;
  label?: string | HTMLElement;
  strip?: string | HTMLElement;
  readerId?: string;
  /** Default true — scroll mode under max-width 768px. */
  mobileDefault?: boolean;
  onPagePaint?: PagePaintHandler;
  onEnterBook?: () => void;
  onEnterScroll?: (strip: HTMLElement) => void;
}

export interface ViewModeApi {
  isVertical: () => boolean;
  setVertical: (on: boolean) => Promise<void>;
  refreshStrip: () => void;
  getStrip: () => HTMLElement | null;
}

export interface ToonManifest {
  title?: string;
  pages?: number;
  files?: string[];
  pattern?: string;
  designWidth?: number;
  designHeight?: number;
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
}

export interface WordEntry {
  x?: number;
  y?: number;
  align?: string;
  size?: number;
  color?: string;
  stroke?: string;
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
