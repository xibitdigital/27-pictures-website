/** Fallback story copy when a toon omits coverSynopsis. */
export const DEFAULT_COVER_STORY =
  "An interactive FlipFrame experiment from twentyseven.pictures — turn the pages, tap the captions, follow the case.";

/** Resolve cover synopsis for display (trimmed prop or shared fallback). */
export function resolveCoverStory(synopsis?: string | null): string {
  return synopsis?.trim() || DEFAULT_COVER_STORY;
}
