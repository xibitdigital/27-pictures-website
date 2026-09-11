<script setup lang="ts">
import { LoaderCircle } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { isDirectProvider as isDirectProviderName, type PageRecord, type SeriesGenerateConfig } from "../types";
import EditorCheckbox from "./ui/EditorCheckbox.vue";
import EditorDialog from "./ui/EditorDialog.vue";
import EditorSelect from "./ui/EditorSelect.vue";
import EditorSelectItem from "./ui/EditorSelectItem.vue";

const props = defineProps<{
  open: boolean;
  generate: SeriesGenerateConfig | null;
  pages: Pick<PageRecord, "id" | "position" | "fileUrl" | "kind" | "regions">[];
  busy: boolean;
  status: string;
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

const COUNT_OPTIONS = [1, 2, 3, 4] as const;

const prompt = ref("");
const includePrevious = ref(false);
const previousPageId = ref("");
/** One shape's own image inside a layout page — mutually exclusive with previousPageId. */
const previousRegionId = ref("");
const previousFile = ref<File | null>(null);
const previousFileInput = ref<HTMLInputElement | null>(null);
const count = ref("1");

const hasPreviousSlot = computed(() => (props.generate?.slots || []).some((s) => s.kind === "previous"));
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
const styleSlot = computed(() => (props.generate?.slots || []).find((s) => s.kind === "style" && s.fileUrl) || null);
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
function isIncluded(alias: string): boolean {
  return !excludedAliases.value.has(alias);
}
function setIncluded(alias: string, included: boolean): void {
  const next = new Set(excludedAliases.value);
  if (included) next.delete(alias);
  else next.add(alias);
  excludedAliases.value = next;
}

const fluxSheets = computed(() => (props.generate?.slots || []).filter((s) => s.kind === "sheet" && s.fileUrl));
const includedRefCount = computed(() => fluxSheets.value.filter((s) => isIncluded(s.alias)).length);

/**
 * Flux gets no fixed FORMAT/PIN prefix the way the Comfy graph does — every
 * generation has to spell out "Image N = what" itself or reference adherence
 * drifts (see docs.bfl.ml/guides/prompting_editing_overview's own example).
 * The reference mapping is mechanically built from the series' ready,
 * included sheets, in the same order the Worker actually sends them, so
 * "Image N" here always matches reality. No fixed style line is injected —
 * only this reference-mapping scaffold; the scene/style description is
 * entirely up to whatever the operator types below it.
 */
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
      : providerLabel[props.generate?.provider || ""] || "flux-2-pro (BFL)";
  const header = [`# model: ${modelName}`, "# mode: image-to-image (multi-reference)"];
  const sheets = fluxSheets.value.filter((s) => isIncluded(s.alias));
  if (!sheets.length && !styleSlot.value && !hasPreviousSlot.value) return `${header.join("\n")}\n\n`;
  const refs = sheets.map((s, i) => `Image ${i + 1} = ${s.label || s.alias}`);
  let n = sheets.length;
  // Fixed wording regardless of the slot's own label/alias — "style" here means ink
  // technique/rendering only, and that has to read unambiguously even when the slot
  // was renamed or still carries a stale label like "Image 1 — STYLE (...)".
  if (styleSlot.value) refs.push(`Image ${++n} = style reference (ink technique/rendering only, not a character)`);
  if (hasPreviousSlot.value) refs.push(`Image ${++n} = previous page`);
  header.push(`# refs: ${refs.join("; ")}`);
  const parts = sheets.map((s, i) => `Image ${i + 1} for ${s.label || s.alias}`);
  if (styleSlot.value) parts.push("the style reference for ink technique and rendering style only — not a character");
  if (hasPreviousSlot.value) parts.push("the previous page for continuity of set and style");
  if (!parts.length) return `${header.join("\n")}\n\n`;
  return `${header.join("\n")}\n\nUsing ${parts.join(", ")} — do not alter identity.\n\n`;
});

/** Tracks the last value we auto-wrote, so toggling a reference after open can refresh the preamble without clobbering scene text the user already typed below it. */
const lastAutoPrefill = ref("");

function applyPrefill(): void {
  if (!fluxRefsPrefill.value) return;
  if (prompt.value.trim() && prompt.value !== lastAutoPrefill.value) return;
  prompt.value = fluxRefsPrefill.value;
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
    if (!open) return;
    if (previousPageId.value && !props.pages.some((p) => p.id === previousPageId.value)) {
      previousPageId.value = "";
    }
    if (previousRegionId.value && !selectedPreviousRegion.value) {
      previousRegionId.value = "";
    }
    excludedAliases.value = new Set();
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
  emit("submit", {
    prompt: prompt.value.trim(),
    includePrevious:
      includePrevious.value && Boolean(previousPageId.value || previousRegionId.value || previousFile.value),
    previousPageId: previousPageId.value || null,
    previousRegionId: previousRegionId.value || null,
    previousFile: previousFile.value,
    count: Number(count.value) || 1,
    excludeAliases: isDirectProvider.value ? [...excludedAliases.value] : [],
  });
}
</script>

<template>
  <EditorDialog :open="open" title="Generate page" @update:open="(next) => !next && onCancel()">
    <form class="editor-dialog-form" @submit.prevent="onSubmit">
      <p class="editor-muted">
        {{
          generate?.provider === "flux"
            ? "Uses this series’ reference sheets via Flux."
            : generate?.provider === "replicate-flux"
              ? "Uses up to 2 of this series’ reference sheets via Flux Kontext (Replicate)."
              : generate?.provider === "replicate-seedream"
                ? "Uses this series’ reference sheets via Seedream (Replicate)."
                : generate?.provider === "runware"
                  ? "Uses this series’ reference sheets via Runware."
                  : "Uses this series’ Comfy graph and reference sheets."
        }}
      </p>
      <p v-if="missingComfyFlow" class="editor-error" role="alert">
        Upload a Comfy Save-API graph and reference sheets on the series first.
      </p>
      <label>
        <span class="editor-label-row">
          Prompt
          <button type="button" class="editor-field-link" name="clear-prompt" :disabled="busy" @click="onClearPrompt">
            Clear
          </button>
        </span>
        <textarea
          name="generate-prompt"
          v-model="prompt"
          rows="8"
          cols="40"
          required
          :disabled="busy"
          placeholder="What happens on this page (no balloons, no SFX lettering)"
        />
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
            <div class="editor-plate-picker" role="listbox" aria-label="Plate from this toon">
              <button
                v-for="candidate in previousCandidates"
                :key="candidate.key"
                type="button"
                class="editor-plate-picker-item"
                :class="{
                  'is-selected':
                    candidate.kind === 'page' ? previousPageId === candidate.id : previousRegionId === candidate.id,
                }"
                role="option"
                :aria-selected="
                  candidate.kind === 'page' ? previousPageId === candidate.id : previousRegionId === candidate.id
                "
                :aria-label="candidate.label"
                :disabled="busy"
                @click="pickPrevious(candidate)"
              >
                <img :src="candidate.fileUrl" alt="" />
                <span class="editor-plate-picker-num">{{ candidate.badge }}</span>
              </button>
            </div>
          </div>
          <label>
            Images
            <EditorSelect
              name="generate-count"
              :model-value="count"
              :disabled="busy"
              @update:model-value="(v) => (count = v)"
            >
              <EditorSelectItem v-for="n in COUNT_OPTIONS" :key="n" :value="String(n)">{{ n }}</EditorSelectItem>
            </EditorSelect>
          </label>
          <input
            ref="previousFileInput"
            type="file"
            name="previous-file"
            accept="image/webp,image/jpeg,image/png"
            hidden
            :disabled="busy"
            @change="onPreviousFile"
          />
          <button
            class="editor-btn editor-btn--ghost"
            type="button"
            name="previous-file-pick"
            :disabled="busy"
            @click="pickPreviousFile"
          >
            {{ pages.length ? "Or attach a file" : "Attach a previous plate" }}
          </button>
          <p v-if="previousFile" class="editor-muted">Using {{ previousFile.name }} instead of a toon plate.</p>
        </template>
      </template>
      <label v-if="!hasPreviousSlot || !includePrevious">
        Images
        <EditorSelect
          name="generate-count"
          :model-value="count"
          :disabled="busy"
          @update:model-value="(v) => (count = v)"
        >
          <EditorSelectItem v-for="n in COUNT_OPTIONS" :key="n" :value="String(n)">{{ n }}</EditorSelectItem>
        </EditorSelect>
      </label>
      <p v-if="isFluxKontext" class="editor-muted" role="status">
        Flux Kontext sends at most 2 references — {{ includedRefCount }} included{{
          includedRefCount > 2 ? " (only the first 2 will actually be sent)" : ""
        }}.
      </p>
      <ul v-if="generate?.slots.length" class="editor-dialog-slots">
        <li v-for="slot in generate.slots" :key="slot.alias">
          <span>{{
            slot.rendererInput ? `${slot.rendererInput} — ${slot.label || slot.alias}` : slot.label || slot.alias
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
          <EditorCheckbox
            v-else-if="isDirectProvider && slot.kind === 'sheet' && slot.fileUrl"
            :checked="isIncluded(slot.alias)"
            :name="`include-${slot.alias}`"
            :disabled="busy"
            @update:checked="(v) => setIncluded(slot.alias, v)"
          >
            {{ isIncluded(slot.alias) ? "included" : "not sent this time" }}
          </EditorCheckbox>
          <span v-else-if="slot.fileUrl" class="editor-muted">ready</span>
          <span v-else-if="slot.optional" class="editor-muted">optional — skipped</span>
          <span v-else class="editor-error">missing sheet</span>
        </li>
      </ul>
      <p v-if="busy" class="editor-muted">{{ status || "Generating page…" }}</p>
      <div class="editor-form-actions">
        <button class="editor-btn editor-btn--ghost" type="button" :disabled="busy" @click="onCancel">Cancel</button>
        <button class="editor-btn" type="submit" :class="{ 'is-busy': busy }" :disabled="!canSubmit">
          <LoaderCircle v-if="busy" class="editor-spin" :size="16" aria-hidden="true" />
          {{ busy ? "Generating…" : Number(count) > 1 ? `Generate ${count}` : "Generate" }}
        </button>
      </div>
    </form>
  </EditorDialog>
</template>
