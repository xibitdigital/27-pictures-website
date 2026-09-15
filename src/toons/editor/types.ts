/**
 * Studio types. JSON records come from the Worker contract (`apiTypes.ts`).
 * Visibility labels are UI-only — D1 stores `published`, the form says Public.
 */

export type {
  BubbleRecord,
  CaptionLang,
  CharacterJob,
  CharacterJobStatus,
  CharacterProvider,
  CreditBucket,
  CreditsSnapshot,
  DescriptionMap,
  EditorUser,
  GenerateProvider,
  InviteUserInput,
  InviteUserResult,
  PageFilePatch,
  PageKind,
  PageRecord,
  PromptCandidate,
  PromptTarget,
  PublishSite,
  RegionBorderStyle,
  RegionGeometry,
  RegionRecord,
  RegionShapeType,
  RunComfyModel,
  RunComfyModelCategory,
  RunwareModel,
  SeriesCharacter,
  SeriesFlowSlot,
  SeriesGenerateConfig,
  SeriesInput,
  SeriesOption,
  SeriesSlotKind,
  ToonAsset,
  ToonAssetSource,
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
  parsePublishSite,
  pickDescription,
  PUBLISH_SITES,
  RUNWARE_MODELS,
  USER_KEY_LABELS,
  USER_KEY_NAMES,
} from "../../../worker/toon-editor/src/apiTypes";

import { parsePublishSite, type PublishSite, type ToonStatus } from "../../../worker/toon-editor/src/apiTypes";

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

export const PUBLISH_SITE_OPTIONS: { value: PublishSite; label: string }[] = [
  { value: "studio", label: "27 Pictures" },
  { value: "community", label: "Creator site" },
];

export function publishSiteLabel(site?: string | null): string {
  const parsed = parsePublishSite(site);
  return PUBLISH_SITE_OPTIONS.find((opt) => opt.value === parsed)?.label ?? "27 Pictures";
}

export function visibilityLabel(status?: string | null): string {
  const vis = visibilityFromStatus(status);
  if (vis === "public") return "Public";
  if (vis === "staging") return "Staging";
  return "Draft";
}
