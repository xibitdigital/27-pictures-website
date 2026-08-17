import { DEFAULT_LOCALE } from "../../site/i18n";
import { FLIPFRAME, pickLocalized, type LocalizedString } from "./flipframeCopy";

/** Fallback story copy when a toon omits coverSynopsis. English, for tests. */
export const DEFAULT_COVER_STORY = FLIPFRAME.en.fallbackStory;

/** Resolve cover synopsis for display (trimmed prop, map, or shared fallback). */
export function resolveCoverStory(synopsis?: LocalizedString | null, lang: string = DEFAULT_LOCALE): string {
  return pickLocalized(synopsis, lang, FLIPFRAME[lang as keyof typeof FLIPFRAME]?.fallbackStory || DEFAULT_COVER_STORY);
}
