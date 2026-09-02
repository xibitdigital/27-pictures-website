<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getSeries, readImageSize, saveSeries, uploadSeriesCover, uploadSeriesFlow, uploadSeriesRef } from "../api";
import { CAPTION_LANGS } from "../mapConfig";
import {
  emptyDescriptionMap,
  parseDescriptionMap,
  visibilityFromStatus,
  visibilityLabel,
  type DescriptionMap,
  type SeriesFlowSlot,
  type SeriesOption,
  type ToonListItem,
} from "../types";
import EditorBar from "./EditorBar.vue";
import ToonCard from "./ToonCard.vue";

const route = useRoute();
const router = useRouter();

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
const sort = ref("0");
const descriptions = reactive<DescriptionMap>(emptyDescriptionMap());
const coverPreview = ref("");
const coverFile = ref<File | null>(null);
const existing = ref<SeriesOption | null>(null);
const members = ref<ToonListItem[]>([]);
const error = ref("");
const saving = ref(false);
const plateWidth = ref("1152");
const plateHeight = ref("1728");
const model = ref("seedream 5.0 pro");
const slots = ref<SeriesFlowSlot[]>([]);
const flowLabel = ref("");
const uploadingFlow = ref(false);

function slugFromTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    sort.value = String(body.series.sort ?? 0);
    Object.assign(descriptions, parseDescriptionMap(body.series.descriptions, body.series.description || ""));
    coverPreview.value = body.series.coverUrl || "";
    applyGenerate(body.series);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load";
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
  slots.value = (generate?.slots || []).map((slot) => ({ ...slot }));
  const key = generate?.flowKey || "";
  flowLabel.value = key ? key.split("/").pop() || "uploaded" : "";
}

function generatePayload() {
  return {
    width: Number(plateWidth.value) || null,
    height: Number(plateHeight.value) || null,
    model: model.value.trim(),
    slots: slots.value.map((slot) => ({
      alias: slot.alias.trim(),
      kind: slot.kind,
    })),
  };
}

function addSlot(): void {
  slots.value.push({
    alias: `image-${slots.value.length + 1}`,
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
    error.value = "Save the series first, then upload a flow.";
    return;
  }
  error.value = "";
  uploadingFlow.value = true;
  try {
    const series = await uploadSeriesFlow(existing.value.key, file);
    existing.value = series;
    applyGenerate(series);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Flow upload failed";
  } finally {
    uploadingFlow.value = false;
  }
}

async function onSlotFile(index: number, ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const alias = slots.value[index]?.alias.trim();
  if (!alias || alias === "previous") return;
  if (isCreate.value || !existing.value) {
    error.value = "Save the series first, then upload reference sheets.";
    return;
  }
  error.value = "";
  try {
    const series = await uploadSeriesRef(existing.value.key, alias, file);
    existing.value = series;
    applyGenerate(series);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Reference upload failed";
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
  error.value = "";
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
      hubUrl: hubUrl.value.trim() || `/toons/${seriesKey}/`,
      sort: Number(sort.value) || 0,
      generate: generatePayload(),
    });
    if (coverFile.value) {
      const size = await readImageSize(coverFile.value);
      series = await uploadSeriesCover(series.key, coverFile.value, size);
    }
    existing.value = series;
    applyGenerate(series);
    if (isCreate.value) await router.push(`/series/${series.key}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Save failed";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="editor-page">
    <EditorBar :title="isCreate ? 'New series' : 'Series'">
      <template #actions>
        <button class="editor-btn" type="submit" form="series-meta" :disabled="saving">
          {{ saving ? "Saving…" : isCreate ? "Create" : "Save" }}
        </button>
      </template>
    </EditorBar>
    <form id="series-meta" class="editor-form" novalidate @submit="onSubmit">
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
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
          Sort
          <input v-model="sort" type="number" name="sort" step="1" />
        </label>
        <label>
          Plate width
          <input v-model="plateWidth" type="number" name="plate-width" min="1" step="1" />
        </label>
        <label>
          Plate height
          <input v-model="plateHeight" type="number" name="plate-height" min="1" step="1" />
        </label>
        <label class="editor-form-span">
          Model
          <input v-model="model" name="generate-model" placeholder="seedream 5.0 pro" />
        </label>
        <div class="editor-form-span editor-generate">
          <p class="editor-generate-label">ComfyUI flow</p>
          <p class="editor-muted">
            One API-format graph for every page in this series (Save API / .api.json). Image 1…N order is the PIN order;
            previous plate last.
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

          <p class="editor-generate-label">Reference slots</p>
          <ol class="editor-slot-list">
            <li v-for="(slot, index) in slots" :key="`${index}-${slot.alias}`" class="editor-slot-row">
              <span class="editor-muted">Image {{ index + 1 }}</span>
              <input v-model="slot.alias" :name="`slot-alias-${index}`" :aria-label="`Slot ${index + 1} alias`" />
              <select v-model="slot.kind" :name="`slot-kind-${index}`" :aria-label="`Slot ${index + 1} kind`">
                <option value="sheet">Sheet</option>
                <option value="previous">Previous page</option>
              </select>
              <input
                v-if="slot.kind === 'sheet'"
                type="file"
                accept="image/webp,image/jpeg,image/png"
                :name="`slot-file-${index}`"
                :aria-label="`Slot ${index + 1} image`"
                @change="onSlotFile(index, $event)"
              />
              <span v-else class="editor-muted">Filled from the last plate</span>
              <img v-if="slot.fileUrl" :src="slot.fileUrl" alt="" class="editor-slot-thumb" />
              <button
                class="editor-icon-btn"
                type="button"
                :name="`slot-up-${index}`"
                :disabled="index === 0"
                @click="moveSlot(index, -1)"
              >
                ↑
              </button>
              <button
                class="editor-icon-btn"
                type="button"
                :name="`slot-down-${index}`"
                :disabled="index === slots.length - 1"
                @click="moveSlot(index, 1)"
              >
                ↓
              </button>
              <button class="editor-icon-btn" type="button" :name="`slot-remove-${index}`" @click="removeSlot(index)">
                ×
              </button>
            </li>
          </ol>
          <button class="editor-btn editor-btn--ghost" type="button" name="add-slot" @click="addSlot">Add slot</button>
        </div>
        <label v-for="lang in CAPTION_LANGS" :key="lang.code" class="editor-form-span">
          Description ({{ lang.label }})
          <textarea v-model="descriptions[lang.code]" :name="`description-${lang.code}`" :lang="lang.code" rows="4" />
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
          />
        </li>
        <li>
          <ToonCard add :to="addEpisodeTo" title="Add episode" meta="New" cue="Create" />
        </li>
      </ul>
    </div>
  </div>
</template>
