/**
 * Studio types. JSON records come from the Worker contract (`apiTypes.ts`).
 * Visibility labels are UI-only — D1 stores `published`, the form says Public.
 */

export type {
  BubbleRecord,
  CaptionLang,
  DescriptionMap,
  EditorUser,
  PageRecord,
  SeriesInput,
  SeriesOption,
  ToonListItem,
  ToonMetaInput,
  ToonRecord,
  ToonStatus,
} from "../../../worker/toon-editor/src/apiTypes";
export {
  DESC_LANGS,
  emptyDescriptionMap,
  parseDescriptionMap,
  pickDescription,
} from "../../../worker/toon-editor/src/apiTypes";

import type { ToonStatus } from "../../../worker/toon-editor/src/apiTypes";

export type ToonVisibility = "draft" | "staging" | "public";

export const TOON_VISIBILITY: { value: ToonVisibility; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "staging", label: "Staging" },
  { value: "public", label: "Public" },
];

export function visibilityFromStatus(status?: string | null): ToonVisibility {
  if (status === "published" || status === "public") return "public";
  if (status === "staging") return "staging";
  return "draft";
}

export function statusFromVisibility(visibility: ToonVisibility): ToonStatus {
  if (visibility === "public") return "published";
  if (visibility === "staging") return "staging";
  return "draft";
}

export function visibilityLabel(status?: string | null): string {
  const vis = visibilityFromStatus(status);
  if (vis === "public") return "Public";
  if (vis === "staging") return "Staging";
  return "Draft";
}
