<script setup lang="ts">
import { LoaderCircle } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import type { PageRecord, SeriesGenerateConfig } from "../types";
import EditorCheckbox from "./ui/EditorCheckbox.vue";
import EditorDialog from "./ui/EditorDialog.vue";
import EditorSelect from "./ui/EditorSelect.vue";
import EditorSelectItem from "./ui/EditorSelectItem.vue";

const props = defineProps<{
  open: boolean;
  generate: SeriesGenerateConfig | null;
  pages: Pick<PageRecord, "id" | "position" | "fileUrl">[];
  busy: boolean;
  status: string;
  error: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [
    payload: {
      prompt: string;
      includePrevious: boolean;
      previousPageId: string | null;
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
const previousFile = ref<File | null>(null);
const previousFileInput = ref<HTMLInputElement | null>(null);
const count = ref("1");

const hasPreviousSlot = computed(() => (props.generate?.slots || []).some((s) => s.kind === "previous"));
const selectedPreviousPage = computed(() => props.pages.find((p) => p.id === previousPageId.value) || null);
const isFlux = computed(() => props.generate?.provider === "flux");

/** Flux only — sheets unchecked here are left out of the API call entirely (not just asked to be ignored), the reliable fix when two references (e.g. a doll and a character) are similar enough to bleed into each other. */
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

/**
 * The Comfy graph bakes a fixed FORMAT line into every generation, so every
 * plate reads as the same series regardless of which page or who wrote the
 * prompt. Flux gets no such prefix — each call only has whatever this box
 * contains — so without an equally fixed line here, style drifts request to
 * request even on identical prompts. Keep in sync with the FORMAT line in
 * .claude/skills/horror-toon-page/SKILL.md (trimmed of the page-layout
 * specifics — panel count/dimensions don't apply to every shot, e.g. a
 * single close-up panel).
 */
const FLUX_STYLE_ANCHOR =
  "Black and white horror manga ink style — sharp decisive linework, heavy dark ink washes, strong solid blacks, high-contrast shadows, grey midtones. No color, no speech/thought balloons, no dialogue, no captions, no SFX lettering, no logos, no watermarks, no text in the art.";

/**
 * Flux gets no fixed FORMAT/PIN prefix the way the Comfy graph does — every
 * generation has to spell out "Image N = what" itself or reference adherence
 * drifts (see docs.bfl.ml/guides/prompting_editing_overview's own example).
 * The reference mapping is mechanically built from the series' ready,
 * included sheets, in the same order the Worker actually sends them, so
 * "Image N" here always matches reality.
 */
const fluxRefsPrefill = computed(() => {
  if (!isFlux.value) return "";
  const sheets = fluxSheets.value.filter((s) => isIncluded(s.alias));
  if (!sheets.length) return `${FLUX_STYLE_ANCHOR}\n\n`;
  const parts = sheets.map((s, i) => `Image ${i + 1} for ${s.label || s.alias}`);
  const previous = hasPreviousSlot.value ? ", and the previous page for continuity of set and style" : "";
  return `${FLUX_STYLE_ANCHOR}\n\nUsing ${parts.join(", ")}${previous} — do not alter identity.\n\n`;
});

/** Tracks the last value we auto-wrote, so toggling a reference after open can refresh the preamble without clobbering scene text the user already typed below it. */
const lastAutoPrefill = ref("");

function applyPrefill(): void {
  if (!fluxRefsPrefill.value) return;
  if (prompt.value.trim() && prompt.value !== lastAutoPrefill.value) return;
  prompt.value = fluxRefsPrefill.value;
  lastAutoPrefill.value = fluxRefsPrefill.value;
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
  if (previousFile.value) previousPageId.value = "";
}

function pickPreviousFile(): void {
  previousFileInput.value?.click();
}

const missingSheets = computed(() =>
  (props.generate?.slots || []).filter((slot) => slot.kind === "sheet" && !slot.optional && !slot.fileKey)
);

const missingPrevious = computed(
  () => includePrevious.value && hasPreviousSlot.value && !previousPageId.value && !previousFile.value
);

const canSubmit = computed(
  () =>
    Boolean(props.generate?.flowKey) &&
    Boolean(prompt.value.trim()) &&
    !props.busy &&
    !missingSheets.value.length &&
    !missingPrevious.value
);

function onSubmit(): void {
  if (!canSubmit.value) return;
  emit("submit", {
    prompt: prompt.value.trim(),
    includePrevious: includePrevious.value && Boolean(previousPageId.value || previousFile.value),
    previousPageId: previousPageId.value || null,
    previousFile: previousFile.value,
    count: Number(count.value) || 1,
    excludeAliases: isFlux.value ? [...excludedAliases.value] : [],
  });
}
</script>

<template>
  <EditorDialog :open="open" title="Generate page" @update:open="(next) => !next && onCancel()">
    <form class="editor-dialog-form" @submit.prevent="onSubmit">
      <p class="editor-muted">Uses this series’ Comfy graph and reference sheets.</p>
      <p v-if="!generate?.flowKey" class="editor-error" role="alert">
        Upload a Comfy Save-API graph and reference sheets on the series first.
      </p>
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
      <label>
        Prompt
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
          <div class="editor-pair-row">
            <label v-if="pages.length">
              Plate from this toon
              <EditorSelect
                name="previous-page"
                :model-value="previousPageId"
                :disabled="busy"
                placeholder="Choose a page"
                @update:model-value="(v) => (previousPageId = v)"
              >
                <EditorSelectItem value="">Choose a page</EditorSelectItem>
                <EditorSelectItem v-for="page in pages" :key="page.id" :value="page.id">
                  Page {{ page.position + 1 }}
                </EditorSelectItem>
              </EditorSelect>
            </label>
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
          </div>
          <img
            v-if="selectedPreviousPage?.fileUrl"
            class="editor-slot-thumb"
            :src="selectedPreviousPage.fileUrl"
            alt=""
          />
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
                : "skipped"
          }}</span>
          <EditorCheckbox
            v-else-if="isFlux && slot.fileUrl"
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
