<script setup lang="ts">
import { BookPlus, FolderPlus, Save, Upload, WandSparkles } from "@lucide/vue";
import { computed, inject, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  clearSeriesWatermark,
  generateCharacter,
  getCharacterJob,
  getSeries,
  listRunComfyModels,
  listUsers,
  readImageSize,
  saveSeries,
  uploadSeriesCover,
  uploadSeriesFlow,
  uploadSeriesRef,
  uploadSeriesWatermark,
  type CaptionTranslations,
} from "../api";
import { CAPTION_LANGS, parseHexColor } from "../mapConfig";
import { EDITOR_USER_KEY } from "../session";
import { pushToast } from "../toast";
import {
  emptyDescriptionMap,
  GENERATE_PROVIDERS,
  parseDescriptionMap,
  parsePublishSite,
  PUBLISH_SITE_OPTIONS,
  RUNWARE_MODELS,
  visibilityFromStatus,
  visibilityLabel,
  type CharacterProvider,
  type DescriptionMap,
  type EditorUser,
  type GenerateProvider,
  type PromptCandidate,
  type PublishSite,
  type RegionBorderStyle,
  type RunComfyModel,
  type SeriesFlowSlot,
  type SeriesInput,
  type SeriesOption,
  type ToonListItem,
} from "../types";
import EditorBar from "./EditorBar.vue";
import GenerateCharacterDialog from "./GenerateCharacterDialog.vue";
import TranslateField from "./TranslateField.vue";
import EditorButton from "./ui/EditorButton.vue";
import EditorDialog from "./ui/EditorDialog.vue";
import EditorIconButton from "./ui/EditorIconButton.vue";
import ToonCard from "./ToonCard.vue";
import EditorCheckbox from "./ui/EditorCheckbox.vue";
import EditorColorField from "./ui/EditorColorField.vue";
import EditorUserPills from "./ui/EditorUserPills.vue";
import EditorSelect from "./ui/EditorSelect.vue";
import EditorSelectItem from "./ui/EditorSelectItem.vue";

const route = useRoute();
const router = useRouter();
const userRef = inject(EDITOR_USER_KEY);
const isAdmin = computed(() => userRef?.value?.role === "admin");

const isCreate = computed(() => route.name === "series-new" || !route.params.key);

const nextEpisodeN = computed(() => {
  const nums = members.value.map((toon) => toon.episodeN).filter((n): n is number => n != null);
  return nums.length ? Math.max(...nums) + 1 : 1;
});

const addEpisodeTo = computed(() => `/new?series=${encodeURIComponent(key.value)}&episode=${nextEpisodeN.value}`);

const key = ref("");
const keyTouched = ref(false);
const title = ref("");
const lastDerivedKey = ref("");
const tagline = ref("");
const hubUrl = ref("");
const publishSite = ref<PublishSite>(isAdmin.value ? "studio" : "community");
const sort = ref("0");
const descriptions = reactive<DescriptionMap>(emptyDescriptionMap());
const coverPreview = ref("");
const coverFile = ref<File | null>(null);
const existing = ref<SeriesOption | null>(null);
const members = ref<ToonListItem[]>([]);
const roster = ref<EditorUser[]>([]);
const editorRoster = computed(() => roster.value.filter((u) => u.role === "editor"));
const selectedEditorIds = ref<string[]>([]);

function applyTranslations(map: CaptionTranslations): void {
  descriptions.it = map.it;
  descriptions.de = map.de;
  descriptions.fr = map.fr;
}

onMounted(async () => {
  if (!isAdmin.value) return;
  try {
    roster.value = await listUsers();
  } catch {
    roster.value = [];
  }
});
const saving = ref(false);
const plateWidth = ref("1152");
const plateHeight = ref("1728");

// Starting values for a brand-new bubble/page/region in this series — folded into each creation
// route's own INSERT server-side (see SeriesDefaults in apiTypes.ts), not applied here. Blank/unset
// means "keep the studio's own hardcoded default", same convention the backend uses.
const DEFAULT_COLOR_SWATCH = "#111111";
const defaultBubbleOpacityPct = ref("");
const defaultPageBgColor = ref("");
const defaultPageBgColorSwatch = computed(() => parseHexColor(defaultPageBgColor.value) || DEFAULT_COLOR_SWATCH);
const defaultRegionBorderColor = ref("");
const defaultRegionBorderColorSwatch = computed(
  () => parseHexColor(defaultRegionBorderColor.value) || DEFAULT_COLOR_SWATCH
);
const defaultRegionBorderWidth = ref("");
const defaultRegionBorderStyle = ref<RegionBorderStyle | "">("");

// Range inputs need a real number to show a thumb position — fall back to the placeholder value
// while the field is blank, without writing anything into the (still-unset) text ref itself.
const defaultBubbleOpacitySlider = computed(() =>
  defaultBubbleOpacityPct.value.trim() ? Number(defaultBubbleOpacityPct.value) : 75
);
function onDefaultBubbleOpacitySlider(ev: Event): void {
  defaultBubbleOpacityPct.value = (ev.target as HTMLInputElement).value;
}

const defaultRegionBorderWidthSlider = computed(() =>
  defaultRegionBorderWidth.value.trim() ? Number(defaultRegionBorderWidth.value) : 0
);
function onDefaultRegionBorderWidthSlider(ev: Event): void {
  defaultRegionBorderWidth.value = (ev.target as HTMLInputElement).value;
}

function onDefaultPageBgColorPicker(ev: Event): void {
  const hex = parseHexColor((ev.target as HTMLInputElement).value);
  if (hex) defaultPageBgColor.value = hex;
}

function onDefaultPageBgColorBlur(): void {
  defaultPageBgColor.value = parseHexColor(defaultPageBgColor.value) || "";
}

function onDefaultRegionBorderColorPicker(ev: Event): void {
  const hex = parseHexColor((ev.target as HTMLInputElement).value);
  if (hex) defaultRegionBorderColor.value = hex;
}

function onDefaultRegionBorderColorBlur(): void {
  defaultRegionBorderColor.value = parseHexColor(defaultRegionBorderColor.value) || "";
}
const model = ref("seedream 5.0 pro");
const provider = ref<GenerateProvider>("comfy");
const runComfyModels = ref<RunComfyModel[]>([]);
const runComfyModelsLoading = ref(false);
const runComfyModelsError = ref("");

/** Fetched once per visit to this form, not cached across app loads — RunComfy's own catalog can
 * add models between sessions. */
async function ensureRunComfyModelsLoaded(): Promise<void> {
  if (runComfyModels.value.length || runComfyModelsLoading.value) return;
  runComfyModelsLoading.value = true;
  runComfyModelsError.value = "";
  try {
    runComfyModels.value = await listRunComfyModels();
    if (runComfyModels.value.length && !runComfyModels.value.some((m) => m.id === model.value)) {
      model.value = runComfyModels.value[0].id;
    }
  } catch (err) {
    runComfyModelsError.value = err instanceof Error ? err.message : "Could not load RunComfy models";
  } finally {
    runComfyModelsLoading.value = false;
  }
}

watch(provider, (next, prev) => {
  if (next === "runware" && prev !== "runware" && !RUNWARE_MODELS.some((m) => m.id === model.value)) {
    model.value = RUNWARE_MODELS[0].id;
  }
  if (next === "runcomfy" && prev !== "runcomfy") {
    // Instant, sane default before the catalog call resolves — corrected to the real first
    // catalog entry once ensureRunComfyModelsLoaded() actually loads, same as Runware above.
    if (!model.value.includes("/")) model.value = "bytedance/seedream-5.0-pro";
    void ensureRunComfyModelsLoaded();
  }
});
/** Per-provider hint under the picker — a lookup instead of a nested ternary so a new provider is
 * one line here, not a deeper if/else chain in the template. */
const PROVIDER_HINT: Partial<Record<GenerateProvider, string>> = {
  flux: "Flux ignores the ComfyUI flow below and sends the prompt plus this series's sheets/previous plate straight to flux-2-pro.",
  "replicate-flux":
    "Flux Kontext ignores the ComfyUI flow below. It only accepts 2 reference images — the first 2 included sheets/previous plate are sent, the rest are dropped.",
  "replicate-seedream":
    "Seedream (Replicate) ignores the ComfyUI flow below and sends the prompt plus this series's sheets/previous plate straight to Replicate.",
  runware:
    "Runware ignores the ComfyUI flow below and sends the prompt plus this series's sheets/previous plate to the Runware model picked above.",
  runcomfy:
    "RunComfy ignores the ComfyUI flow below and sends the prompt plus this series's sheets/previous plate to the RunComfy model named above (org/model, e.g. bytedance/seedream-5.0-pro).",
};
const providerHint = computed(() => PROVIDER_HINT[provider.value] || "");
/** New series start with a mandatory "previous plate" and "style" reference — every direct-provider (Flux/Replicate/Runware) call should carry both for continuity, so they're seeded up front and locked (see isLockedSlot) instead of being an opt-in a new series can forget to add. Existing series are untouched; add them by hand if missing. */
const DEFAULT_SLOTS: SeriesFlowSlot[] = [
  { alias: "previous", label: "Previous page", kind: "previous", fileKey: null, fileUrl: null },
  { alias: "style", label: "Style reference", kind: "style", fileKey: null, fileUrl: null },
];
const slots = ref<SeriesFlowSlot[]>(isCreate.value ? DEFAULT_SLOTS.map((slot) => ({ ...slot })) : []);
/** "previous" and "style" are default, always-on references — never removable or re-kindable, on any series (old or new) that has them. */
function isLockedSlot(slot: SeriesFlowSlot): boolean {
  return slot.kind === "previous" || slot.kind === "style";
}
const previewSlot = ref<SeriesFlowSlot | null>(null);
const flowLabel = ref("");
const uploadingFlow = ref(false);
const uploadingWatermark = ref(false);
const promptCandidates = ref<PromptCandidate[]>([]);
/** "" = Auto (legacy: every Seedream node's `prompt`); otherwise `${nodeId}::${inputKey}`. */
const promptTargetKey = ref("");

function candidateKey(nodeId: string, inputKey: string): string {
  return `${nodeId}::${inputKey}`;
}

function slugFromTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normaliseHubUrl(raw: string): string {
  const segments = raw
    .trim()
    .split("/")
    .map((segment) => slugFromTitle(segment))
    .filter(Boolean);
  return segments.length ? `/${segments.join("/")}/` : "";
}

watch(
  () => title.value,
  (value) => {
    if (!isCreate.value || keyTouched.value) return;
    const next = slugFromTitle(value);
    const prevKey = lastDerivedKey.value;
    if (!key.value || key.value === prevKey) key.value = next;
    lastDerivedKey.value = next;
    const prevHub = prevKey ? `/toons/${prevKey}/` : "";
    if (!hubUrl.value || hubUrl.value === prevHub) {
      hubUrl.value = next ? `/toons/${next}/` : "";
    }
  }
);

async function loadSeries(seriesKey: string): Promise<void> {
  try {
    const body = await getSeries(seriesKey);
    existing.value = body.series;
    members.value = body.toons || [];
    key.value = body.series.key;
    title.value = body.series.title;
    tagline.value = body.series.tagline || "";
    hubUrl.value = body.series.hubUrl || `/toons/${body.series.key}/`;
    publishSite.value = parsePublishSite(body.series.publishSite, isAdmin.value ? "studio" : "community");
    sort.value = String(body.series.sort ?? 0);
    Object.assign(descriptions, parseDescriptionMap(body.series.descriptions, body.series.description || ""));
    coverPreview.value = body.series.coverUrl || "";
    selectedEditorIds.value = body.series.editorIds || [];
    applyGenerate(body.series);
    applyDefaults(body.series);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Failed to load");
  }
}

watch(
  () => String(route.params.key || ""),
  (seriesKey) => {
    if (isCreate.value || !seriesKey) return;
    void loadSeries(seriesKey);
  },
  { immediate: true }
);

function applyGenerate(series: SeriesOption): void {
  const generate = series.generate;
  plateWidth.value = generate?.width != null ? String(generate.width) : plateWidth.value;
  plateHeight.value = generate?.height != null ? String(generate.height) : plateHeight.value;
  model.value = generate?.model || model.value;
  provider.value = generate?.provider && GENERATE_PROVIDERS.includes(generate.provider) ? generate.provider : "comfy";
  slots.value = (generate?.slots || []).map((slot) => ({ ...slot }));
  const key = generate?.flowKey || "";
  flowLabel.value = key ? key.split("/").pop() || "uploaded" : "";
  promptCandidates.value = generate?.promptCandidates || [];
  const target = generate?.promptTarget;
  promptTargetKey.value = target ? candidateKey(target.nodeId, target.inputKey) : "";
}

function applyDefaults(series: SeriesOption): void {
  const d = series.defaults;
  defaultBubbleOpacityPct.value = d?.bubbleOpacity != null ? String(Math.round(d.bubbleOpacity * 100)) : "";
  defaultPageBgColor.value = d?.pageBgColor || "";
  defaultRegionBorderColor.value = d?.regionBorderColor || "";
  defaultRegionBorderWidth.value = d?.regionBorderWidth != null ? String(d.regionBorderWidth) : "";
  defaultRegionBorderStyle.value = d?.regionBorderStyle || "";
}

function defaultsPayload(): SeriesInput["defaults"] {
  const pct = defaultBubbleOpacityPct.value.trim();
  const width = defaultRegionBorderWidth.value.trim();
  return {
    bubbleOpacity: pct ? Math.max(0, Math.min(100, Number(pct))) / 100 : null,
    pageBgColor: defaultPageBgColor.value.trim() || null,
    regionBorderColor: defaultRegionBorderColor.value.trim() || null,
    regionBorderWidth: width ? Number(width) : null,
    regionBorderStyle: defaultRegionBorderStyle.value || null,
  };
}

function generatePayload() {
  const [nodeId, inputKey] = promptTargetKey.value ? promptTargetKey.value.split("::") : [];
  return {
    width: Number(plateWidth.value) || null,
    height: Number(plateHeight.value) || null,
    model: model.value.trim(),
    provider: provider.value,
    slots: slots.value.map((slot) => ({
      alias: slot.alias.trim(),
      label: (slot.label || slot.alias).trim(),
      kind: slot.kind,
      optional: slot.kind === "sheet" ? Boolean(slot.optional) : false,
      rendererInput: slot.rendererInput || null,
      loadNodeId: slot.loadNodeId || null,
    })),
    promptTarget: nodeId && inputKey ? { nodeId, inputKey } : null,
  };
}

function addSlot(): void {
  const n = slots.value.length + 1;
  slots.value.push({
    alias: `image-${n}`,
    label: `Image ${n}`,
    kind: "sheet",
    fileKey: null,
    fileUrl: null,
  });
}

function removeSlot(index: number): void {
  slots.value.splice(index, 1);
}

function moveSlot(index: number, dir: -1 | 1): void {
  const next = index + dir;
  if (next < 0 || next >= slots.value.length) return;
  const copy = slots.value.slice();
  const [row] = copy.splice(index, 1);
  copy.splice(next, 0, row);
  slots.value = copy;
}

async function onFlow(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (isCreate.value || !existing.value) {
    pushToast("Save the series first, then upload a flow.");
    return;
  }
  uploadingFlow.value = true;
  try {
    const series = await uploadSeriesFlow(existing.value.key, file);
    existing.value = series;
    applyGenerate(series);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Flow upload failed");
  } finally {
    uploadingFlow.value = false;
  }
}

async function onWatermark(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (isCreate.value || !existing.value) {
    pushToast("Save the series first, then upload a watermark.");
    return;
  }
  uploadingWatermark.value = true;
  try {
    existing.value = await uploadSeriesWatermark(existing.value.key, file);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Watermark upload failed");
  } finally {
    uploadingWatermark.value = false;
  }
}

async function onClearWatermark(): Promise<void> {
  if (!existing.value || uploadingWatermark.value) return;
  uploadingWatermark.value = true;
  try {
    existing.value = await clearSeriesWatermark(existing.value.key);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not clear the watermark");
  } finally {
    uploadingWatermark.value = false;
  }
}

function pickSlotFile(index: number): void {
  const input = document.querySelector(`input[name="slot-file-${index}"]`);
  if (input instanceof HTMLInputElement) input.click();
}

async function onSlotFile(index: number, ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const alias = slots.value[index]?.alias.trim();
  if (!alias) {
    pushToast("Give this slot a name before uploading a sheet for it.");
    return;
  }
  if (alias === "previous") {
    pushToast(
      'This slot is the previous-plate reference — it\'s filled automatically at generate time, not uploaded. Set its kind to "Previous page" (or give it a different name if it should take its own file).'
    );
    return;
  }
  if (isCreate.value || !existing.value) {
    pushToast("Save the series first, then upload reference sheets.");
    return;
  }
  try {
    const series = await uploadSeriesRef(existing.value.key, alias, file);
    existing.value = series;
    const uploaded = (series.generate?.slots || []).find((s) => s.alias === alias);
    if (uploaded) {
      slots.value[index] = { ...slots.value[index], fileKey: uploaded.fileKey, fileUrl: uploaded.fileUrl };
    }
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Reference upload failed");
  }
}

/** Character generation is text-to-image only — Flux/Replicate here are edit-only models with no
 * verified prompt-only id, so the "Generate" button only appears for Runware/RunComfy. */
const characterProvider = computed<CharacterProvider | null>(() =>
  provider.value === "runware" || provider.value === "runcomfy" ? provider.value : null
);
const canGenerateCharacter = computed(() => characterProvider.value != null);
const characterDialogSlotIndex = ref<number | null>(null);
const characterBusy = ref(false);
const characterStatus = ref("");

function openCharacterDialog(index: number): void {
  const alias = slots.value[index]?.alias.trim();
  if (!alias) {
    pushToast("Give this slot a name before generating a character for it.");
    return;
  }
  if (isCreate.value || !existing.value) {
    pushToast("Save the series first, then generate a character.");
    return;
  }
  characterDialogSlotIndex.value = index;
}

function closeCharacterDialog(): void {
  if (characterBusy.value) return;
  characterDialogSlotIndex.value = null;
}

async function onCharacterSubmit(payload: { prompt: string; model: string }): Promise<void> {
  const index = characterDialogSlotIndex.value;
  const genProvider = characterProvider.value;
  if (index == null || !existing.value || !genProvider) return;
  const alias = slots.value[index].alias.trim();
  characterBusy.value = true;
  const started = Date.now();
  const clock = (): string => {
    const s = Math.floor((Date.now() - started) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const setStatus = (label: string): void => {
    characterStatus.value = `${label} · ${clock()}`;
  };
  setStatus("Queuing…");
  const tick = window.setInterval(() => {
    const current = characterStatus.value.replace(/ · \d+:\d+$/, "");
    setStatus(current || "Generating…");
  }, 1000);
  try {
    const job = await generateCharacter(existing.value.key, {
      prompt: payload.prompt,
      slotAlias: alias,
      provider: genProvider,
      model: payload.model,
    });
    setStatus("Generating…");
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      const snap = await getCharacterJob(existing.value.key, job.id);
      if (snap.status === "done") {
        if (snap.series) existing.value = snap.series;
        if (snap.character) {
          slots.value[index] = {
            ...slots.value[index],
            fileKey: snap.character.fileKey,
            fileUrl: snap.character.fileUrl,
          };
        }
        characterDialogSlotIndex.value = null;
        return;
      }
      if (snap.status === "error") {
        pushToast(snap.error || "Character generation failed");
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    pushToast("Timed out waiting for the character generation");
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Character generation failed");
  } finally {
    window.clearInterval(tick);
    characterBusy.value = false;
  }
}

function onCover(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  coverFile.value = file;
  if (coverPreview.value.startsWith("blob:")) URL.revokeObjectURL(coverPreview.value);
  coverPreview.value = file ? URL.createObjectURL(file) : existing.value?.coverUrl || "";
}

async function onSubmit(ev: Event): Promise<void> {
  ev.preventDefault();
  saving.value = true;
  try {
    const desc: DescriptionMap = {
      en: descriptions.en.trim(),
      it: descriptions.it.trim(),
      de: descriptions.de.trim(),
      fr: descriptions.fr.trim(),
    };
    const seriesKey = (isCreate.value ? key.value : String(route.params.key)).trim();
    let series = await saveSeries({
      key: seriesKey,
      title: title.value.trim(),
      tagline: tagline.value.trim(),
      description: desc.en,
      descriptions: desc,
      hubUrl: normaliseHubUrl(hubUrl.value) || `/toons/${seriesKey}/`,
      publishSite: publishSite.value,
      sort: Number(sort.value) || 0,
      generate: generatePayload(),
      defaults: defaultsPayload(),
      ...(isAdmin.value ? { editorIds: selectedEditorIds.value } : {}),
    });
    if (coverFile.value) {
      const size = await readImageSize(coverFile.value);
      series = await uploadSeriesCover(series.key, coverFile.value, size);
    }
    existing.value = series;
    applyGenerate(series);
    applyDefaults(series);
    if (isCreate.value) await router.push(`/series/${series.key}`);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Save failed");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="editor-page">
    <EditorBar :title="isCreate ? 'New series' : 'Series'">
      <template #actions>
        <EditorButton v-if="!isCreate" variant="ghost" :to="addEpisodeTo">
          <BookPlus :size="16" :stroke-width="1.4" aria-hidden="true" />
          New toon
        </EditorButton>
      </template>
      <template #primary>
        <EditorButton type="submit" form="series-meta" :disabled="saving">
          <FolderPlus v-if="isCreate" :size="16" :stroke-width="1.4" aria-hidden="true" />
          <Save v-else :size="16" :stroke-width="1.4" aria-hidden="true" />
          {{ saving ? "Saving…" : isCreate ? "Create" : "Save" }}
        </EditorButton>
      </template>
    </EditorBar>
    <div class="editor-page-body">
      <form id="series-meta" class="editor-form" novalidate @submit="onSubmit">
        <div class="editor-form-main">
          <label v-if="isCreate" class="editor-form-span">
            Key
            <input v-model="key" name="key" required autocomplete="off" @input="keyTouched = true" />
          </label>
          <p v-else class="editor-muted">Key: {{ key }}</p>

          <label>
            Title
            <input v-model="title" name="title" required />
          </label>
          <label>
            Tagline
            <input v-model="tagline" name="tagline" />
          </label>
          <label>
            Hub URL
            <input v-model="hubUrl" name="hub-url" placeholder="/toons/erin-and-the-goblins/" />
          </label>
          <label>
            Publish on
            <EditorSelect v-model="publishSite" name="publish-site">
              <EditorSelectItem v-for="opt in PUBLISH_SITE_OPTIONS" :key="opt.value" :value="opt.value">{{
                opt.label
              }}</EditorSelectItem>
            </EditorSelect>
          </label>
          <p class="editor-muted editor-form-span">
            {{
              publishSite === "community"
                ? "Public episodes appear on the creator site, not on twentyseven.pictures/toons/."
                : "Public episodes appear on the 27 Pictures catalog at /toons/."
            }}
          </p>
          <label>
            Sort
            <input v-model="sort" type="number" name="sort" step="1" />
          </label>
          <div class="editor-form-span editor-generate">
            <p class="editor-generate-label">Defaults for new items</p>
            <p class="editor-muted">
              Starting values for a brand-new bubble, page, or layout region in this series — a designer can still
              change any of these afterward. Leave blank to keep the studio's own defaults.
            </p>
            <div class="editor-defaults-grid">
              <label>
                Bubble opacity (%)
                <span class="editor-slider-row">
                  <input
                    type="range"
                    name="default-bubble-opacity-slider"
                    min="0"
                    max="100"
                    step="1"
                    :value="defaultBubbleOpacitySlider"
                    :aria-valuemin="0"
                    :aria-valuemax="100"
                    :aria-valuenow="defaultBubbleOpacitySlider"
                    @input="onDefaultBubbleOpacitySlider"
                  />
                  <input
                    v-model="defaultBubbleOpacityPct"
                    type="number"
                    name="default-bubble-opacity"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="75"
                  />
                </span>
              </label>
              <label>
                Page background
                <EditorColorField
                  v-model="defaultPageBgColor"
                  :swatch="defaultPageBgColorSwatch"
                  name="default-page-bg-color"
                  swatch-name="default-page-bg-color-swatch"
                  :ariaLabel="'Default page background color'"
                  @picker="onDefaultPageBgColorPicker"
                  @blur="onDefaultPageBgColorBlur"
                />
              </label>
              <label>
                Region border color
                <EditorColorField
                  v-model="defaultRegionBorderColor"
                  :swatch="defaultRegionBorderColorSwatch"
                  name="default-region-border-color"
                  swatch-name="default-region-border-color-swatch"
                  :ariaLabel="'Default region border color'"
                  @picker="onDefaultRegionBorderColorPicker"
                  @blur="onDefaultRegionBorderColorBlur"
                />
              </label>
              <label>
                Region border width
                <span class="editor-slider-row">
                  <input
                    type="range"
                    name="default-region-border-width-slider"
                    min="0"
                    max="20"
                    step="0.5"
                    :value="defaultRegionBorderWidthSlider"
                    :aria-valuemin="0"
                    :aria-valuemax="20"
                    :aria-valuenow="defaultRegionBorderWidthSlider"
                    @input="onDefaultRegionBorderWidthSlider"
                  />
                  <input
                    v-model="defaultRegionBorderWidth"
                    type="number"
                    name="default-region-border-width"
                    min="0"
                    max="20"
                    step="0.5"
                    placeholder="0"
                  />
                </span>
              </label>
              <label>
                Region border style
                <EditorSelect
                  v-model="defaultRegionBorderStyle"
                  name="default-region-border-style"
                  aria-label="Default region border style"
                >
                  <EditorSelectItem value="">Studio default</EditorSelectItem>
                  <EditorSelectItem value="solid">Solid</EditorSelectItem>
                  <EditorSelectItem value="dashed">Dashed</EditorSelectItem>
                  <EditorSelectItem value="dotted">Dotted</EditorSelectItem>
                </EditorSelect>
              </label>
            </div>
          </div>
          <div v-if="isAdmin" class="editor-form-span editor-generate">
            <p class="editor-generate-label">Editors</p>
            <p class="editor-muted">Who can create/manage toons under this series (capped at draft/staging).</p>
            <EditorUserPills v-model="selectedEditorIds" :options="editorRoster" />
            <p v-if="!editorRoster.length" class="editor-muted">
              No editor accounts yet —
              <RouterLink class="editor-field-link" to="/users">invite one first</RouterLink>.
            </p>
          </div>
          <label>
            Plate width
            <input v-model="plateWidth" type="number" name="plate-width" min="1" step="1" />
          </label>
          <label>
            Plate height
            <input v-model="plateHeight" type="number" name="plate-height" min="1" step="1" />
          </label>
          <label v-if="provider === 'runware'" class="editor-form-span">
            Runware model
            <EditorSelect v-model="model" name="generate-model" aria-label="Runware model">
              <EditorSelectItem v-for="m in RUNWARE_MODELS" :key="m.id" :value="m.id">{{ m.label }}</EditorSelectItem>
            </EditorSelect>
          </label>
          <label v-else-if="provider === 'runcomfy' && runComfyModels.length" class="editor-form-span">
            RunComfy model
            <EditorSelect v-model="model" name="generate-model" aria-label="RunComfy model">
              <EditorSelectItem v-for="m in runComfyModels" :key="m.id" :value="m.id">{{ m.label }}</EditorSelectItem>
            </EditorSelect>
          </label>
          <label v-else-if="provider === 'runcomfy'" class="editor-form-span">
            RunComfy model
            <input v-model="model" name="generate-model" placeholder="bytedance/seedream-5.0-pro" />
            <p v-if="runComfyModelsLoading" class="editor-muted">Loading RunComfy's model catalog…</p>
            <p v-else-if="runComfyModelsError" class="editor-error">
              {{ runComfyModelsError }} — type the model id (org/model) by hand instead.
            </p>
          </label>
          <label v-else class="editor-form-span">
            Model
            <input v-model="model" name="generate-model" placeholder="seedream 5.0 pro" />
          </label>
          <label class="editor-form-span">
            Generation provider
            <EditorSelect v-model="provider" name="generate-provider" aria-label="Generation provider">
              <EditorSelectItem value="comfy">ComfyUI</EditorSelectItem>
              <EditorSelectItem value="flux">Flux (flux-2-pro, direct via BFL)</EditorSelectItem>
              <EditorSelectItem value="replicate-flux">Flux Kontext (via Replicate, max 2 refs)</EditorSelectItem>
              <EditorSelectItem value="replicate-seedream">Seedream (via Replicate)</EditorSelectItem>
              <EditorSelectItem value="runware">Runware (pick model above)</EditorSelectItem>
              <EditorSelectItem value="runcomfy">RunComfy (org/model above, max 10 refs)</EditorSelectItem>
            </EditorSelect>
          </label>
          <p v-if="provider !== 'comfy'" class="editor-muted editor-form-span">{{ providerHint }}</p>
          <div class="editor-form-span editor-generate">
            <p class="editor-generate-label">Watermark</p>
            <p class="editor-muted">
              Optional PNG with transparency. Plate pages bake it into the file on generate/upload/replace. Layout pages
              show it as a locked last layer (not a selectable region) and Save layout bakes the same placement into the
              plate. Area/region fills stay clean. Leave unset to skip.
            </p>
            <label>
              Watermark image (.png)
              <input
                type="file"
                name="series-watermark"
                accept="image/png"
                :disabled="uploadingWatermark"
                @change="onWatermark"
              />
            </label>
            <p v-if="existing?.watermarkUrl" class="editor-muted">
              <img :src="existing.watermarkUrl" alt="" class="editor-watermark-preview" />
              <EditorButton variant="ghost" :disabled="uploadingWatermark" @click="onClearWatermark">
                {{ uploadingWatermark ? "Clearing…" : "Clear watermark" }}
              </EditorButton>
            </p>
            <p v-else class="editor-muted">No watermark set. Pages stay unwatermarked.</p>
          </div>
          <div class="editor-form-span editor-generate">
            <template v-if="provider === 'comfy'">
              <p class="editor-generate-label">ComfyUI flow</p>
              <p class="editor-muted">
                One API-format graph for every page in this series (Save API / .api.json). Image 1…N follows the PIN
                titles, not Comfy node ids — re-upload after changing wires. Previous plate last.
              </p>
              <label>
                Flow (.api.json)
                <input
                  type="file"
                  name="series-flow"
                  accept="application/json,.json"
                  :disabled="uploadingFlow"
                  @change="onFlow"
                />
              </label>
              <p v-if="flowLabel" class="editor-muted">Uploaded: {{ flowLabel }}</p>
              <p v-else class="editor-muted">No flow yet. Save the series, then upload the graph.</p>

              <template v-if="promptCandidates.length">
                <p class="editor-generate-label">Prompt goes into</p>
                <p class="editor-muted">
                  Where the typed page prompt is written on generate. Pick the flow’s Prompt / Text node (the
                  concatenate PREFIX stays as FORMAT + PIN). Auto writes onto every Seedream node’s own
                  <code>prompt</code>.
                </p>
                <EditorSelect v-model="promptTargetKey" name="prompt-target" aria-label="Prompt target">
                  <EditorSelectItem value="">Auto (every Seedream node's prompt)</EditorSelectItem>
                  <EditorSelectItem
                    v-for="c in promptCandidates"
                    :key="candidateKey(c.nodeId, c.inputKey)"
                    :value="candidateKey(c.nodeId, c.inputKey)"
                  >
                    {{ c.label }} — “{{ c.preview }}”
                  </EditorSelectItem>
                </EditorSelect>
              </template>
            </template>

            <p class="editor-generate-label">Reference slots</p>
            <p class="editor-muted">Order is Image 1…N from the flow titles (uncrossed onto Seedream’s pins).</p>
            <ol class="editor-slot-list">
              <li v-for="(slot, index) in slots" :key="`${index}-${slot.alias}`" class="editor-slot-row">
                <span class="editor-muted" :data-renderer-input="slot.rendererInput || undefined">{{
                  slot.rendererInput || `slot ${index + 1}`
                }}</span>
                <input
                  v-model="slot.label"
                  :name="`slot-label-${index}`"
                  :aria-label="`Slot ${index + 1} name`"
                  :placeholder="`Image ${index + 1}`"
                />
                <EditorSelect
                  v-model="slot.kind"
                  :disabled="isLockedSlot(slot)"
                  :name="`slot-kind-${index}`"
                  :aria-label="`Slot ${index + 1} kind`"
                >
                  <EditorSelectItem value="sheet">Sheet</EditorSelectItem>
                  <EditorSelectItem value="previous">Previous</EditorSelectItem>
                  <EditorSelectItem value="style">Style</EditorSelectItem>
                </EditorSelect>
                <EditorCheckbox
                  v-if="slot.kind === 'sheet'"
                  class="editor-slot-optional"
                  :checked="Boolean(slot.optional)"
                  :name="`slot-optional-${index}`"
                  @update:checked="(checked) => (slot.optional = checked)"
                >
                  Optional
                </EditorCheckbox>
                <span v-else></span>
                <span v-if="slot.kind !== 'previous'" class="editor-slot-file-actions">
                  <input
                    type="file"
                    accept="image/webp,image/jpeg,image/png"
                    :name="`slot-file-${index}`"
                    :aria-label="`Slot ${index + 1} image`"
                    hidden
                    @change="onSlotFile(index, $event)"
                  />
                  <EditorButton variant="ghost" :name="`slot-file-pick-${index}`" @click="pickSlotFile(index)">
                    <Upload :size="14" :stroke-width="1.6" aria-hidden="true" />
                    Attach
                  </EditorButton>
                  <EditorButton
                    v-if="canGenerateCharacter"
                    variant="ghost"
                    :name="`slot-generate-${index}`"
                    @click="openCharacterDialog(index)"
                  >
                    <WandSparkles :size="14" :stroke-width="1.6" aria-hidden="true" />
                    Generate
                  </EditorButton>
                </span>
                <span v-else class="editor-muted">Last plate</span>
                <button
                  v-if="slot.fileUrl"
                  class="editor-slot-thumb"
                  type="button"
                  :name="`slot-preview-${index}`"
                  :aria-label="`View ${slot.label || `Image ${index + 1}`}`"
                  @click="previewSlot = slot"
                >
                  <img :src="slot.fileUrl" alt="" />
                </button>
                <span v-else class="editor-slot-thumb" aria-hidden="true"></span>
                <span class="editor-slot-actions">
                  <EditorIconButton :name="`slot-up-${index}`" :disabled="index === 0" @click="moveSlot(index, -1)">
                    ↑
                  </EditorIconButton>
                  <EditorIconButton
                    :name="`slot-down-${index}`"
                    :disabled="index === slots.length - 1"
                    @click="moveSlot(index, 1)"
                  >
                    ↓
                  </EditorIconButton>
                  <EditorIconButton
                    variant="danger"
                    :name="`slot-remove-${index}`"
                    :disabled="isLockedSlot(slot)"
                    :title="isLockedSlot(slot) ? 'Default slot — cannot be removed' : undefined"
                    @click="removeSlot(index)"
                  >
                    ×
                  </EditorIconButton>
                </span>
              </li>
            </ol>
            <EditorButton variant="ghost" name="add-slot" @click="addSlot"> Add slot </EditorButton>
          </div>
          <label v-for="lang in CAPTION_LANGS" :key="lang.code" class="editor-form-span">
            Description ({{ lang.label }})
            <TranslateField v-if="lang.code === 'en'" :source="descriptions.en" @translated="applyTranslations">
              <textarea
                v-model="descriptions[lang.code]"
                :name="`description-${lang.code}`"
                :lang="lang.code"
                rows="4"
              />
            </TranslateField>
            <textarea
              v-else
              v-model="descriptions[lang.code]"
              :name="`description-${lang.code}`"
              :lang="lang.code"
              rows="4"
            />
          </label>
        </div>
        <aside class="editor-form-preview">
          <label>
            Cover image
            <input type="file" accept="image/webp,image/jpeg,image/png" @change="onCover" />
          </label>
          <div class="series-grid">
            <ToonCard
              :title="title.trim() || key || 'Untitled series'"
              :meta="tagline.trim()"
              :cue="members.length ? `${members.length} episodes` : 'Series'"
              :description="descriptions.en.trim()"
              :cover-url="coverPreview || null"
            />
          </div>
        </aside>
      </form>
      <div v-if="!isCreate" class="editor-list-body">
        <h2 class="editor-list-heading">Episodes</h2>
        <ul class="editor-card-list">
          <li v-for="toon in members" :key="toon.id">
            <ToonCard
              :to="`/${toon.id}`"
              :title="toon.title || toon.slug"
              :meta="toon.episodeN != null ? `Episode ${toon.episodeN}` : toon.subtitle || ''"
              :cue="toon.pageCount ? `${toon.pageCount} pages` : toon.slug"
              :cover-url="toon.coverUrl"
              :badge="visibilityLabel(toon.status)"
              :visibility="visibilityFromStatus(toon.status)"
              :share-href="toon.readerUrl || `/toons/${toon.slug}/`"
            />
          </li>
          <li>
            <ToonCard add :to="addEpisodeTo" title="Add episode" meta="New" cue="Create" />
          </li>
        </ul>
      </div>
    </div>
    <EditorDialog
      :open="Boolean(previewSlot?.fileUrl)"
      :title="previewSlot?.label || 'Reference'"
      preview
      @update:open="(open) => !open && (previewSlot = null)"
    >
      <img v-if="previewSlot?.fileUrl" data-slot-preview :src="previewSlot.fileUrl" alt="" />
    </EditorDialog>
    <GenerateCharacterDialog
      v-if="characterDialogSlotIndex !== null && characterProvider"
      :open="true"
      :slot-label="slots[characterDialogSlotIndex]?.label || slots[characterDialogSlotIndex]?.alias || 'character'"
      :provider="characterProvider"
      :runware-model="model"
      :busy="characterBusy"
      :status="characterStatus"
      @close="closeCharacterDialog"
      @submit="onCharacterSubmit"
    />
  </div>
</template>
