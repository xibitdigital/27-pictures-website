/**
 * FlipFrame book reader package — engine, surface, shell, chrome, audio, captions.
 */

// Engine
export { createBookEngine, initToonBook, type BookEngine, type BookEngineState } from "./bookReader";
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
export { default as CoverFirstPage } from "./CoverFirstPage.vue";
export { default as BackCoverLink } from "./BackCoverLink.vue";
export { DEFAULT_COVER_STORY, resolveCoverStory } from "./coverStory";

// Shell + view modes
export { default as ToonReaderShell } from "./ToonReaderShell.vue";
export { default as VerticalStrip } from "./VerticalStrip.vue";
export { useViewMode, prefersMobileScroll, MOBILE_MAX_WIDTH } from "./useViewMode";
export {
  loadConfig,
  loadConfigPages,
  createConfigLoader,
  pagesFromConfig,
  resolveConfigUrl,
  clearConfigCache,
  // deprecated aliases
  loadManifest,
  createManifestLoader,
  pagesFromManifest,
} from "./loadConfig";
export { parsePageQuery, contentPageToViewIndex } from "./pageQuery";
export { getAssetBase, resolveAssetUrl, resolvePageUrls, toSitePath } from "./assetUrl";

// Chrome
export { FullscreenButton, ViewModeToggle, ReaderTopBar } from "./chrome";

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
export { loadWords, resolveWordsAssets, LANG_STORAGE_KEY } from "./words";
export { default as LangSwitcher } from "./LangSwitcher.vue";
export { default as PageCaptions } from "./captions/PageCaptions.vue";
export { default as WordLayer } from "./captions/WordLayer.vue";
export { default as WordCaption } from "./captions/WordCaption.vue";
export { default as BubbleChrome } from "./captions/BubbleChrome.vue";
export {
  buildCaption,
  buildCaptions,
  imageContentBox,
  readingOrder,
  resolveStroke,
  resolveText,
  resolveVariant,
  toFraction,
  type CaptionModel,
  type CaptionContext,
} from "./captions/captionModel";
export { buildBubbleChrome, type BubbleChromeModel } from "./captions/bubbleChrome";
export {
  createAutoReadController,
  provideAutoRead,
  useAutoReadController,
  type AutoReadController,
  type AutoReadOptions,
} from "./captions/useAutoRead";
export {
  createToonCaptions,
  provideToonCaptions,
  useToonCaptions,
  type ToonCaptionsStore,
  type ToonCaptionsOptions,
} from "./captions/useToonCaptions";

// Bubble chrome (speech balloons, AI panels, burst stars)
export {
  BUBBLE_STROKE_WIDTH,
  DEFAULT_ORGANIC_BUBBLE,
  mulberry32,
  hashSeed,
  sketchyBubblePath,
  jaggedBoxPath,
  cleanBoxPath,
  starBurstPath,
  resolveBubbleStyle,
  type BubbleTail,
  type BubbleStyle,
} from "./bubbles";

// Types
export type * from "./types";
