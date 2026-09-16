<script setup lang="ts">
import { Eraser } from "@lucide/vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from "vue";
import {
  isDirectProvider as isDirectProviderName,
  type GenerateProvider,
  type PageRecord,
  type SeriesGenerateConfig,
} from "../types";
import EditorButton from "./ui/EditorButton.vue";
import EditorCheckbox from "./ui/EditorCheckbox.vue";
import EditorDialog from "./ui/EditorDialog.vue";
import EditorGenerateFooter from "./ui/EditorGenerateFooter.vue";
import EditorIconButton from "./ui/EditorIconButton.vue";
import EditorPlatePicker from "./ui/EditorPlatePicker.vue";

const props = defineProps<{
  open: boolean;
  generate: SeriesGenerateConfig | null;
  pages: Pick<PageRecord, "id" | "position" | "fileUrl" | "kind" | "regions">[];
  busy: boolean;
  status: string;
  /** Series key (or toon id, for an ungrouped toon) — which references were unchecked last time
   * is remembered per series/toon, not reset on every reopen (see excludedAliases below). */
  storageKey?: string | null;
}>();

const emit = defineEmits<{
  close: [];
  submit: [
    payload: {
      prompt: string;
      includePrevious: boolean;
      previousPageId: string | null;
      previousRegionId: string | null;
      previousFile: File | null;
      count: number;
      excludeAliases: string[];
    },
  ];
}>();

const prompt = ref("");
const includePrevious = ref(false);
const previousPageId = ref("");
/** One shape's own image inside a layout page — mutually exclusive with previousPageId. */
const previousRegionId = ref("");
const previousFile = ref<File | null>(null);
const previousFileInput = ref<HTMLInputElement | null>(null);
const promptEl = ref<HTMLTextAreaElement | null>(null);
const mentionListEl = ref<HTMLElement | null>(null);
const debugOpen = ref(false);
const mentionOpen = ref(false);
const mentionQuery = ref("");
const mentionStart = ref(-1);
const mentionIndex = ref(0);

const hasPreviousSlot = computed(() => (props.generate?.slots || []).some((s) => s.kind === "previous"));
/** Whether a previous plate will actually be sent this call — the legend must match this, not just
 * whether the series has a "previous" slot at all, or it claims an "Image N = previous page" that
 * the checkbox above (unticked, or ticked with nothing picked yet) never actually attaches. */
const willSendPrevious = computed(
  () =>
    includePrevious.value &&
    hasPreviousSlot.value &&
    Boolean(previousPageId.value || previousRegionId.value || previousFile.value)
);
const sortedPages = computed(() => [...props.pages].sort((a, b) => a.position - b.position));
/** One entry per selectable reference plate: a whole "plate" page, or — for a "layout" page — each of
 * its own shape images individually, never the page's flattened composite (that would just repeat the
 * same character/object already covered by the series' own reference sheets, not a distinct plate). */
const previousCandidates = computed(() => {
  const out: { key: string; kind: "page" | "region"; id: string; fileUrl: string; label: string; badge: string }[] = [];
  for (const page of sortedPages.value) {
    if (page.kind === "layout") {
      (page.regions || []).forEach((region, i) => {
        if (!region.fileUrl) return;
        out.push({
          key: `region:${region.id}`,
          kind: "region",
          id: region.id,
          fileUrl: region.fileUrl,
          label: `Page ${page.position + 1} · shape ${i + 1}`,
          badge: `${page.position + 1}.${i + 1}`,
        });
      });
    } else if (page.fileUrl) {
      out.push({
        key: `page:${page.id}`,
        kind: "page",
        id: page.id,
        fileUrl: page.fileUrl,
        label: `Page ${page.position + 1}`,
        badge: String(page.position + 1),
      });
    }
  }
  return out;
});
function pickPrevious(candidate: { kind: "page" | "region"; id: string }): void {
  const already =
    candidate.kind === "page" ? previousPageId.value === candidate.id : previousRegionId.value === candidate.id;
  previousPageId.value = "";
  previousRegionId.value = "";
  if (already) return;
  if (candidate.kind === "page") previousPageId.value = candidate.id;
  else previousRegionId.value = candidate.id;
}
const previousPickerItems = computed(() =>
  previousCandidates.value.map((candidate) => ({
    key: candidate.key,
    src: candidate.fileUrl,
    label: candidate.label,
    badge: candidate.badge,
    selected:
      candidate.kind === "page" ? previousPageId.value === candidate.id : previousRegionId.value === candidate.id,
    disabled: props.busy,
  }))
);
function onPickPrevious(key: string): void {
  const candidate = previousCandidates.value.find((item) => item.key === key);
  if (candidate) pickPrevious(candidate);
}
const selectedPreviousPage = computed(() => props.pages.find((p) => p.id === previousPageId.value) || null);
const selectedPreviousRegion = computed(() => {
  if (!previousRegionId.value) return null;
  for (const page of props.pages) {
    const region = (page.regions || []).find((r) => r.id === previousRegionId.value);
    if (region) return region;
  }
  return null;
});
/** Any provider that skips the Comfy graph entirely and sends the prompt + reference sheets straight to a hosted model (BFL Flux, Replicate, or Runware). Shared with the Worker contract (apiTypes.ts) so a new provider can't silently fall through to the Comfy-only copy/warning below. */
const isDirectProvider = computed(() => isDirectProviderName(props.generate?.provider));
const isFluxKontext = computed(() => props.generate?.provider === "replicate-flux");

/** Direct-provider only — sheets unchecked here are left out of the API call entirely (not just asked to be ignored), the reliable fix when two references (e.g. a doll and a character) are similar enough to bleed into each other. Flux Kontext (replicate-flux) only ever sends the first 2 included, so this is also how an operator picks which 2. */
const excludedAliases = ref<Set<string>>(new Set());

function excludedStorageKey(): string | null {
  return props.storageKey ? `editor-generate-excluded:${props.storageKey}` : null;
}

function readExcluded(): Set<string> {
  const storageKey = excludedStorageKey();
  if (!storageKey) return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeExcluded(next: Set<string>): void {
  const storageKey = excludedStorageKey();
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...next]));
  } catch {
    /* private mode — just doesn't persist across opens this visit */
  }
}

function isIncluded(alias: string): boolean {
  return !excludedAliases.value.has(alias);
}
function setIncluded(alias: string, included: boolean): void {
  const next = new Set(excludedAliases.value);
  if (included) next.delete(alias);
  else next.add(alias);
  excludedAliases.value = next;
  writeExcluded(next);
}

/**
 * Slot labels are old free text — many still carry a leading "Image N — " stamped on
 * when the slot was numbered differently (a different sheet count, a different order,
 * before it became "style"/"previous"). Left in, the legend can say "Image 1 = Image 3 —
 * Victim": a number that contradicts the "Image 1" it's actually being sent as. Strip any
 * such prefix so the legend only ever states the slot's actual position in *this* call.
 */
function cleanSlotLabel(slot: { label: string; alias: string }): string {
  return (slot.label || slot.alias).replace(/^image\s*\d+\s*[—–-]\s*/i, "").trim() || slot.alias;
}

/**
 * Every slot the Worker will actually attach for this call, in the exact order
 * it iterates `generate.slots` (generatePage.ts's `for (const slot of generate.slots)`
 * loop, shared verbatim by all four direct providers) — a sheet with a file that's
 * still checked, a style slot with a file, or "previous" when it will actually be
 * sent. Building the legend from this instead of grouping sheets-then-style-then-
 * previous is what keeps "Image N" true to reality: a style/previous slot earlier
 * in the series' own slot order (e.g. slot 1 is "STYLE") is sent as Image 1, not
 * pushed to the end because of what kind it is.
 */
const orderedRefEntries = computed(() => {
  const slots = props.generate?.slots || [];
  const out: { kind: "sheet" | "style" | "previous"; label: string; alias: string }[] = [];
  for (const slot of slots) {
    if (slot.kind === "sheet") {
      if (!slot.fileUrl || !isIncluded(slot.alias)) continue;
      out.push({ kind: "sheet", label: cleanSlotLabel(slot), alias: slot.alias });
    } else if (slot.kind === "style") {
      if (!slot.fileUrl) continue;
      out.push({ kind: "style", label: "", alias: "style" });
    } else if (slot.kind === "previous") {
      if (!willSendPrevious.value) continue;
      out.push({ kind: "previous", label: "", alias: "previous" });
    }
  }
  return out;
});
const includedRefCount = computed(() => orderedRefEntries.value.length);

type MentionOption = { tag: string; alias: string; hint: string };

const mentionOptions = computed((): MentionOption[] => {
  const out: MentionOption[] = [];
  for (const [i, entry] of orderedRefEntries.value.entries()) {
    if (entry.kind === "style") continue;
    const hint = `Image ${i + 1}`;
    if (entry.kind === "previous") {
      out.push({ tag: "previous page", alias: "previous", hint });
      continue;
    }
    out.push({ tag: entry.label || entry.alias, alias: entry.alias, hint });
  }
  if (hasPreviousSlot.value && !out.some((opt) => opt.alias === "previous")) {
    out.push({ tag: "previous page", alias: "previous", hint: "" });
  }
  return out;
});

const mentionMenuStyle = ref<CSSProperties>({});

function placeMentionMenu(): void {
  const el = promptEl.value;
  if (!el) return;
  const box = el.getBoundingClientRect();
  const gap = 4;
  const roomBelow = window.innerHeight - box.bottom - gap;
  const roomAbove = box.top - gap;
  const cap = 12 * 16;
  let top = box.bottom + gap;
  let maxHeight = Math.min(cap, Math.max(4 * 16, roomBelow));
  if (roomBelow < 8 * 16 && roomAbove > roomBelow) {
    maxHeight = Math.min(cap, Math.max(4 * 16, roomAbove));
    top = box.top - gap - maxHeight;
  }
  mentionMenuStyle.value = {
    position: "fixed",
    top: `${top}px`,
    left: `${box.left}px`,
    width: `${box.width}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: 500,
  };
}

function onMentionReposition(): void {
  if (mentionOpen.value) placeMentionMenu();
}

const mentionMatches = computed(() => {
  const q = mentionQuery.value.trim().toLowerCase();
  if (!q) return mentionOptions.value;
  return mentionOptions.value.filter((opt) => {
    const hay = `${opt.tag} ${opt.hint} ${opt.alias}`.toLowerCase();
    return hay.includes(q);
  });
});

const highlightEl = ref<HTMLElement | null>(null);

function escapeHtml(raw: string): string {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightIncludedRefs(text: string): string {
  const tags = mentionOptions.value
    .map((opt) => opt.tag)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!tags.length) return escapeHtml(text);
  const parts: string[] = [];
  let i = 0;
  while (i < text.length) {
    let hit: string | null = null;
    for (const tag of tags) {
      const slice = text.slice(i, i + tag.length);
      if (slice.toLowerCase() !== tag.toLowerCase()) continue;
      const beforeOk = i === 0 || !/[A-Za-z0-9]/.test(text.charAt(i - 1));
      const afterOk = i + tag.length >= text.length || !/[A-Za-z0-9]/.test(text.charAt(i + tag.length));
      if (beforeOk && afterOk) {
        hit = slice;
        break;
      }
    }
    if (hit) {
      parts.push(`<strong>${escapeHtml(hit)}</strong>`);
      i += hit.length;
    } else {
      parts.push(escapeHtml(text.charAt(i)));
      i += 1;
    }
  }
  return parts.join("");
}

const highlightedPrompt = computed(() => highlightIncludedRefs(prompt.value) + "\n");

function onPromptScroll(): void {
  const src = promptEl.value;
  const dest = highlightEl.value;
  if (!src || !dest) return;
  dest.scrollTop = src.scrollTop;
  dest.scrollLeft = src.scrollLeft;
}

function mentionAt(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && /[A-Za-z0-9]/.test(before.charAt(at - 1))) return null;
  const query = before.slice(at + 1);
  if (/[\s\n]/.test(query)) return null;
  return { start: at, query };
}

function syncMentionFromEl(el: HTMLTextAreaElement): void {
  const cursor = el.selectionStart ?? el.value.length;
  const hit = mentionAt(el.value, cursor);
  if (!hit || !mentionOptions.value.length) {
    mentionOpen.value = false;
    return;
  }
  mentionStart.value = hit.start;
  mentionQuery.value = hit.query;
  mentionOpen.value = true;
  if (mentionIndex.value >= mentionMatches.value.length) mentionIndex.value = 0;
  void nextTick(() => placeMentionMenu());
}

function onPromptInput(ev: Event): void {
  const el = ev.target as HTMLTextAreaElement;
  syncMentionFromEl(el);
}

function onPromptKeyup(ev: KeyboardEvent): void {
  if (ev.key === "Escape" || ev.key === "Enter") return;
  const el = ev.target as HTMLTextAreaElement;
  syncMentionFromEl(el);
}

function closeMention(): void {
  mentionOpen.value = false;
  mentionQuery.value = "";
  mentionStart.value = -1;
  mentionIndex.value = 0;
}

function insertMention(opt: MentionOption): void {
  const el = promptEl.value;
  const start = mentionStart.value;
  if (!el || start < 0) return;
  const cursor = el.selectionStart ?? prompt.value.length;
  const token = `${opt.tag} `;
  prompt.value = prompt.value.slice(0, start) + token + prompt.value.slice(cursor);
  closeMention();
  const caret = start + token.length;
  void nextTick(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
    closeMention();
  });
}

function onPromptKeydown(ev: KeyboardEvent): void {
  if (!mentionOpen.value || !mentionMatches.value.length) {
    if (ev.key === "Escape") closeMention();
    return;
  }
  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    mentionIndex.value = (mentionIndex.value + 1) % mentionMatches.value.length;
    return;
  }
  if (ev.key === "ArrowUp") {
    ev.preventDefault();
    mentionIndex.value = (mentionIndex.value - 1 + mentionMatches.value.length) % mentionMatches.value.length;
    return;
  }
  if (ev.key === "Enter" || ev.key === "Tab") {
    const opt = mentionMatches.value[mentionIndex.value];
    if (opt) {
      ev.preventDefault();
      insertMention(opt);
    }
    return;
  }
  if (ev.key === "Escape") {
    ev.preventDefault();
    closeMention();
  }
}

watch(mentionMatches, (list) => {
  if (mentionIndex.value >= list.length) mentionIndex.value = 0;
});

watch([mentionIndex, mentionOpen], () => {
  if (!mentionOpen.value) return;
  void nextTick(() => {
    placeMentionMenu();
    mentionListEl.value?.querySelector("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
  });
});

onMounted(() => {
  window.addEventListener("resize", onMentionReposition);
  window.addEventListener("scroll", onMentionReposition, true);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", onMentionReposition);
  window.removeEventListener("scroll", onMentionReposition, true);
});

function previousRefUrl(): string {
  if (previousFile.value) return `(file) ${previousFile.value.name}`;
  if (selectedPreviousRegion.value?.fileUrl) return selectedPreviousRegion.value.fileUrl;
  if (selectedPreviousPage.value?.fileUrl) return selectedPreviousPage.value.fileUrl;
  return "";
}

type DebugRef = { image: string; kind: string; label: string; url: string };

function debugRequest(): {
  provider: string | null;
  model: string | null;
  width: number | null;
  height: number | null;
  numberResults: number;
  positivePrompt: string;
  referenceImages: string[];
  referenceMap: DebugRef[];
  deliveryMethod?: string;
} {
  const generate = props.generate;
  const referenceMap: DebugRef[] = [];
  const referenceImages: string[] = [];
  let n = 0;
  for (const slot of generate?.slots || []) {
    let url = "";
    let label = "";
    if (slot.kind === "sheet") {
      if (!slot.fileUrl || !isIncluded(slot.alias)) continue;
      url = slot.fileUrl;
      label = cleanSlotLabel(slot);
    } else if (slot.kind === "style") {
      if (!slot.fileUrl) continue;
      url = slot.fileUrl;
      label = "style reference";
    } else if (slot.kind === "previous") {
      if (!willSendPrevious.value) continue;
      url = previousRefUrl();
      label = previousRegionId.value ? "previous shape" : "previous page";
    } else {
      continue;
    }
    n += 1;
    referenceImages.push(url);
    referenceMap.push({ image: `Image ${n}`, kind: slot.kind, label, url });
  }
  const payload: ReturnType<typeof debugRequest> = {
    provider: generate?.provider || null,
    model: generate?.model || null,
    width: generate?.width ?? null,
    height: generate?.height ?? null,
    numberResults: 1,
    positivePrompt: prompt.value,
    referenceImages,
    referenceMap,
  };
  if (generate?.provider === "runware") payload.deliveryMethod = "async";
  return payload;
}

const debugPayload = computed(() => debugRequest());
const debugJson = computed(() => JSON.stringify(debugPayload.value, null, 2));
const debugPreviewUrls = computed(() => {
  const urls: string[] = [];
  for (const item of debugPayload.value.referenceMap) {
    if (item.url.startsWith("http") || item.url.startsWith("/")) urls.push(item.url);
  }
  return urls;
});

/**
 * Flux gets no fixed FORMAT/PIN prefix the way the Comfy graph does — every
 * generation has to spell out "Image N = what" itself or reference adherence
 * drifts (see docs.bfl.ml/guides/prompting_editing_overview's own example).
 * The reference mapping is mechanically built from orderedRefEntries, so
 * "Image N" here always matches reality. A style slot adds a PIN that that
 * Image owns ink/palette; character sheets stay identity only. No canned
 * "black and white manga" line — the style image is the lock.
 */
/** What the dialog's intro line says per provider — a lookup instead of a nested ternary so a new
 * provider is one line here, not a deeper if/else chain in the template. */
const PROVIDER_INTRO: Partial<Record<GenerateProvider, string>> = {
  flux: "Uses this series’ reference sheets via Flux.",
  "replicate-flux": "Uses up to 2 of this series’ reference sheets via Flux Kontext (Replicate).",
  "replicate-seedream": "Uses this series’ reference sheets via Seedream (Replicate).",
  runware: "Uses this series’ reference sheets via Runware.",
  runcomfy: "Uses this series’ reference sheets via RunComfy.",
};
const providerIntro = computed(
  () =>
    (props.generate?.provider && PROVIDER_INTRO[props.generate.provider]) ||
    "Uses this series’ Comfy graph and reference sheets."
);

const providerLabel: Record<string, string> = {
  flux: "flux-2-pro (BFL)",
  "replicate-flux": "flux-kontext-apps/multi-image-kontext-pro (Replicate)",
  "replicate-seedream": "bytedance/seedream-4 (Replicate)",
};

const fluxRefsPrefill = computed(() => {
  if (!isDirectProvider.value) return "";
  const modelName =
    props.generate?.provider === "runware"
      ? `Runware — ${props.generate.model || "no model configured"}`
      : props.generate?.provider === "runcomfy"
        ? `RunComfy — ${props.generate.model || "no model configured"}`
        : providerLabel[props.generate?.provider || ""] || "flux-2-pro (BFL)";
  const header = [`# model: ${modelName}`, "# mode: image-to-image (multi-reference)"];
  const entries = orderedRefEntries.value;
  if (!entries.length) return `${header.join("\n")}\n\n`;
  const refs = entries.map((e, i) => {
    // Fixed wording for style/previous regardless of the slot's own label/alias — "style"
    // here means ink technique/rendering only, and that has to read unambiguously even when
    // the slot was renamed or still carries a stale label like "Image 1 — STYLE (...)".
    const what =
      e.kind === "style"
        ? "style reference (ink technique/rendering only, not a character)"
        : e.kind === "previous"
          ? "previous page"
          : e.label;
    return `Image ${i + 1} = ${what}`;
  });
  header.push(`# refs: ${refs.join("; ")}`);
  const parts: string[] = [];
  const stylePins: string[] = [];
  for (const [i, e] of entries.entries()) {
    const n = i + 1;
    if (e.kind === "style") {
      parts.push(`Image ${n} for ink technique and rendering style only — not a character`);
      stylePins.push(
        `match ink technique, line, and palette from Image ${n} only; character sheets are identity and costume, not color or rendering`
      );
    } else if (e.kind === "previous") {
      parts.push(`Image ${n} for continuity of set`);
    } else {
      parts.push(`Image ${n} for ${e.label}`);
    }
  }
  let body = `Using ${parts.join(", ")}.`;
  if (stylePins.length) {
    body += ` PIN: ${stylePins.join(
      "; "
    )}. Do not copy color or rendering from the character sheets. Do not alter character identity.`;
  } else {
    body += ` Do not alter identity.`;
  }
  return `${header.join("\n")}\n\n${body}\n\n`;
});

/** Tracks the last value we auto-wrote, so toggling a reference after open can refresh the preamble without clobbering scene text the user already typed below it. */
const lastAutoPrefill = ref("");

function applyPrefill(): void {
  if (!fluxRefsPrefill.value) return;
  // The operator's own scene text is whatever comes after our last auto-written block — swap just
  // that leading block for the fresh one so toggling a checkbox mid-typing still updates the header
  // instead of silently doing nothing once the prompt no longer matches the old block verbatim.
  if (prompt.value.startsWith(lastAutoPrefill.value)) {
    prompt.value = fluxRefsPrefill.value + prompt.value.slice(lastAutoPrefill.value.length);
  } else if (!prompt.value.trim()) {
    prompt.value = fluxRefsPrefill.value;
  } else {
    return;
  }
  lastAutoPrefill.value = fluxRefsPrefill.value;
}

/** Wipes the prompt — for a direct provider (Flux/Replicate/Runware) the reference legend is required, so it's put right back rather than left blank. */
function onClearPrompt(): void {
  prompt.value = "";
  applyPrefill();
}

watch(fluxRefsPrefill, () => {
  if (props.open) applyPrefill();
});

watch(
  () => props.open,
  (open) => {
    if (!open) {
      debugOpen.value = false;
      closeMention();
      return;
    }
    if (previousPageId.value && !props.pages.some((p) => p.id === previousPageId.value)) {
      previousPageId.value = "";
    }
    if (previousRegionId.value && !selectedPreviousRegion.value) {
      previousRegionId.value = "";
    }
    excludedAliases.value = readExcluded();
    applyPrefill();
  }
);

function onCancel(): void {
  if (props.busy) return;
  emit("close");
}

function onPreviousFile(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  previousFile.value = input.files?.[0] || null;
  if (previousFile.value) {
    previousPageId.value = "";
    previousRegionId.value = "";
  }
}

function pickPreviousFile(): void {
  previousFileInput.value?.click();
}

const missingSheets = computed(() =>
  (props.generate?.slots || []).filter((slot) => slot.kind === "sheet" && !slot.optional && !slot.fileKey)
);

const missingPrevious = computed(
  () =>
    includePrevious.value &&
    hasPreviousSlot.value &&
    !previousPageId.value &&
    !previousRegionId.value &&
    !previousFile.value
);

/** Comfy needs its uploaded Save-API graph; Flux never reads that graph at all. */
const missingComfyFlow = computed(() => !isDirectProvider.value && !props.generate?.flowKey);

const canSubmit = computed(
  () =>
    !missingComfyFlow.value &&
    Boolean(prompt.value.trim()) &&
    !props.busy &&
    !missingSheets.value.length &&
    !missingPrevious.value
);

function onSubmit(): void {
  if (!canSubmit.value) return;
  // Unchecking "Include previous page" must actually stop it from being sent — the server fills
  // the "previous" slot from previousPageId/previousRegionId directly, with no gate of its own on
  // this checkbox, so a plate/file picked earlier has to be nulled out here, not just left
  // "unincluded" while its id is still sitting in this dialog's own state.
  const sendPrevious =
    includePrevious.value && Boolean(previousPageId.value || previousRegionId.value || previousFile.value);
  emit("submit", {
    prompt: prompt.value.trim(),
    includePrevious: sendPrevious,
    previousPageId: sendPrevious ? previousPageId.value || null : null,
    previousRegionId: sendPrevious ? previousRegionId.value || null : null,
    previousFile: sendPrevious ? previousFile.value : null,
    count: 1,
    excludeAliases: isDirectProvider.value ? [...excludedAliases.value] : [],
  });
}
</script>

<template>
  <EditorDialog :open="open" title="Generate page" wide tall hide-close @update:open="(next) => !next && onCancel()">
    <form class="editor-dialog-form editor-dialog-form--fill" @submit.prevent="onSubmit">
      <div class="editor-dialog-scroll">
        <p class="editor-muted">{{ providerIntro }}</p>
        <p v-if="missingComfyFlow" class="editor-error" role="alert">
          Upload a Comfy Save-API graph and reference sheets on the series first.
        </p>
        <div class="editor-generate-columns">
          <div class="editor-generate-main">
            <label>
              <span class="editor-label-row">
                Prompt
                <EditorIconButton
                  name="clear-prompt"
                  aria-label="Clear prompt"
                  title="Clear prompt"
                  :disabled="busy"
                  @click="onClearPrompt"
                >
                  <Eraser :size="14" :stroke-width="1.6" aria-hidden="true" />
                </EditorIconButton>
              </span>
              <span class="editor-prompt-wrap">
                <span
                  ref="highlightEl"
                  class="editor-prompt-highlight"
                  data-prompt-highlight
                  aria-hidden="true"
                  v-html="highlightedPrompt"
                />
                <textarea
                  ref="promptEl"
                  name="generate-prompt"
                  v-model="prompt"
                  rows="16"
                  cols="40"
                  required
                  :disabled="busy"
                  placeholder="What happens on this page (no balloons, no SFX lettering). Type @ to tag an included reference."
                  @input="onPromptInput"
                  @keyup="onPromptKeyup"
                  @keydown="onPromptKeydown"
                  @scroll="onPromptScroll"
                />
              </span>
              <Teleport to="body">
                <ul
                  v-if="mentionOpen"
                  ref="mentionListEl"
                  class="editor-mention-menu"
                  role="listbox"
                  aria-label="Included references"
                  data-mention-list
                  :style="mentionMenuStyle"
                >
                  <li v-if="!mentionMatches.length" class="editor-muted" role="presentation">No matching reference</li>
                  <li v-for="(opt, i) in mentionMatches" :key="opt.alias">
                    <button
                      type="button"
                      role="option"
                      :name="`mention-${opt.alias}`"
                      :aria-selected="i === mentionIndex"
                      :class="{ 'is-active': i === mentionIndex }"
                      @mousedown.prevent="insertMention(opt)"
                    >
                      <span>{{ opt.tag }}</span>
                      <span v-if="opt.hint" class="editor-muted">{{ opt.hint }}</span>
                    </button>
                  </li>
                </ul>
              </Teleport>
            </label>
            <template v-if="hasPreviousSlot">
              <EditorCheckbox
                :checked="includePrevious"
                name="include-previous"
                :disabled="busy"
                @update:checked="(v) => (includePrevious = v)"
              >
                Include previous page
              </EditorCheckbox>
              <template v-if="includePrevious">
                <div v-if="previousCandidates.length" class="editor-form-span">
                  <span class="editor-generate-label">Plate from this toon</span>
                  <p class="editor-muted">
                    A layout page lists each of its own shapes here, not the flattened page — pick the one shape that's
                    actually the reference.
                  </p>
                  <EditorPlatePicker
                    :items="previousPickerItems"
                    ariaLabel="Plate from this toon"
                    @pick="onPickPrevious"
                  />
                </div>
                <input
                  ref="previousFileInput"
                  type="file"
                  name="previous-file"
                  accept="image/webp,image/jpeg,image/png"
                  hidden
                  :disabled="busy"
                  @change="onPreviousFile"
                />
                <EditorButton variant="ghost" name="previous-file-pick" :disabled="busy" @click="pickPreviousFile">
                  {{ pages.length ? "Or attach a file" : "Attach a previous plate" }}
                </EditorButton>
                <p v-if="previousFile" class="editor-muted">Using {{ previousFile.name }} instead of a toon plate.</p>
              </template>
            </template>
          </div>
          <div v-if="generate?.slots.length" class="editor-generate-refs">
            <span class="editor-generate-label">References</span>
            <p v-if="isFluxKontext" class="editor-muted" role="status">
              Flux Kontext sends at most 2 references — {{ includedRefCount }} included{{
                includedRefCount > 2 ? " (only the first 2 will actually be sent)" : ""
              }}.
            </p>
            <ul class="editor-dialog-slots">
              <li
                v-for="slot in generate.slots"
                :key="slot.alias"
                :class="{ 'is-toggle-row': isDirectProvider && slot.kind === 'sheet' && slot.fileUrl }"
              >
                <button
                  v-if="isDirectProvider && slot.kind === 'sheet' && slot.fileUrl"
                  type="button"
                  class="editor-dialog-slot-toggle"
                  :class="{ 'is-checked': isIncluded(slot.alias) }"
                  :name="`include-${slot.alias}`"
                  :aria-pressed="isIncluded(slot.alias)"
                  :disabled="busy"
                  @click="setIncluded(slot.alias, !isIncluded(slot.alias))"
                >
                  <span>{{
                    slot.rendererInput
                      ? `${slot.rendererInput} — ${slot.label || slot.alias}`
                      : slot.label || slot.alias
                  }}</span>
                  <span class="editor-muted">{{ isIncluded(slot.alias) ? "included" : "not sent this time" }}</span>
                </button>
                <template v-else>
                  <span>{{
                    slot.rendererInput
                      ? `${slot.rendererInput} — ${slot.label || slot.alias}`
                      : slot.label || slot.alias
                  }}</span>
                  <span v-if="slot.kind === 'previous'" class="editor-muted">{{
                    previousFile
                      ? "custom file"
                      : selectedPreviousPage
                        ? `page ${selectedPreviousPage.position + 1}`
                        : selectedPreviousRegion
                          ? "shape image"
                          : "skipped"
                  }}</span>
                  <span v-else-if="slot.fileUrl" class="editor-muted">ready</span>
                  <span v-else-if="slot.optional" class="editor-muted">optional — skipped</span>
                  <span v-else class="editor-error">missing sheet</span>
                </template>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <EditorGenerateFooter
        :busy="busy"
        :status="status"
        default-status="Generating page…"
        submit-label="Generate"
        :can-submit="canSubmit"
        @cancel="onCancel"
      >
        <EditorButton variant="ghost" type="button" name="generate-debug" :disabled="busy" @click="debugOpen = true">
          Debug
        </EditorButton>
      </EditorGenerateFooter>
    </form>
  </EditorDialog>
  <EditorDialog :open="debugOpen" title="Generate request" @update:open="(next) => (debugOpen = next)">
    <pre class="editor-debug-json">{{ debugJson }}</pre>
    <div v-if="debugPreviewUrls.length" class="editor-debug-refs">
      <img v-for="url in debugPreviewUrls" :key="url" :src="url" alt="" />
    </div>
  </EditorDialog>
</template>
