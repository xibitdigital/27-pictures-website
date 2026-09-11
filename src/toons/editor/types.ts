/**
 * Studio types. JSON records come from the Worker contract (`apiTypes.ts`).
 * Visibility labels are UI-only — D1 stores `published`, the form says Public.
 */

export type {
  BubbleRecord,
  CaptionLang,
  CreditBucket,
  CreditsSnapshot,
  DescriptionMap,
  EditorUser,
  GenerateProvider,
  InviteUserInput,
  InviteUserResult,
  PageKind,
  PageRecord,
  PromptCandidate,
  PromptTarget,
  RegionBorderStyle,
  RegionGeometry,
  RegionRecord,
  RegionShapeType,
  RunwareModel,
  SeriesFlowSlot,
  SeriesGenerateConfig,
  SeriesInput,
  SeriesOption,
  SeriesSlotKind,
  ToonAsset,
  ToonListItem,
  ToonMetaInput,
  ToonRecord,
  ToonStatus,
  UserKeyName,
  UserKeyStatus,
  UserRole,
} from "../../../worker/toon-editor/src/apiTypes";
export {
  DESC_LANGS,
  emptyDescriptionMap,
  GENERATE_PROVIDERS,
  isDirectProvider,
  parseDescriptionMap,
  pickDescription,
  RUNWARE_MODELS,
  USER_KEY_LABELS,
  USER_KEY_NAMES,
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
