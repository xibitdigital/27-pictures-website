/**
 * FlipFrame book reader package — engine, surface, shell, chrome, audio, captions.
 */

// Engine
export {
  createBookEngine,
  initToonBook,
  type BookEngine,
  type BookEngineState,
} from "./bookReader";
export { useToonBook } from "./useToonBook";
export type { SlotModel, FlipModel, FlipFaceModel } from "./bookModels";
export {
  prefersReduceMotion,
  prefersSinglePage,
  totalSpreadsFor,
  slotForSpread,
  singleViewContent,
} from "./bookModels";

// Surface / covers
export { default as BookSurface } from "./BookSurface.vue";
export { default as BookSlot } from "./BookSlot.vue";
export { default as FlipLeaf } from "./FlipLeaf.vue";
export { default as FrontCoverInstructions } from "./FrontCoverInstructions.vue";
export { default as BackCoverLink } from "./BackCoverLink.vue";

// Shell + view modes
export { default as ToonReaderShell } from "./ToonReaderShell.vue";
export { default as VerticalStrip } from "./VerticalStrip.vue";
export { useViewMode, prefersMobileScroll, MOBILE_MAX_WIDTH } from "./useViewMode";
export {
  loadManifest,
  createManifestLoader,
  pagesFromManifest,
} from "./loadManifest";

// Chrome
export {
  FullscreenButton,
  ViewModeToggle,
  ReaderTopBar,
} from "./chrome";

// Audio
export {
  collectWordAudioUrls,
  preloadAudioUrl,
  preloadAudioUrls,
  useSoundGate,
  type UseSoundGateOptions,
  type UseSoundGateApi,
} from "./audio";

// Captions
export { WordOverlay, loadWords, LANG_STORAGE_KEY } from "./words";

// Types
export type * from "./types";
