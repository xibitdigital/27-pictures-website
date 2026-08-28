<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getSeries, readImageSize, saveSeries, uploadSeriesCover } from "../api";
import { CAPTION_LANGS } from "../mapConfig";
import {
  emptyDescriptionMap,
  parseDescriptionMap,
  visibilityFromStatus,
  visibilityLabel,
  type DescriptionMap,
  type SeriesOption,
  type ToonListItem,
} from "../types";
import EditorBar from "./EditorBar.vue";
import ToonCard from "./ToonCard.vue";

const route = useRoute();
const router = useRouter();

const isCreate = computed(() => route.name === "series-new" || !route.params.key);

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
    });
    if (coverFile.value) {
      const size = await readImageSize(coverFile.value);
      series = await uploadSeriesCover(series.key, coverFile.value, size);
    }
    existing.value = series;
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
      <p v-if="!members.length" class="editor-muted">No episodes yet. Assign this series on a toon’s metadata.</p>
      <ul v-else class="editor-card-list">
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
      </ul>
    </div>
  </div>
</template>
