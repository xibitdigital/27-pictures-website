<script setup lang="ts">
import { Images } from "@lucide/vue";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { createToon, getToon, listSeries, patchToon, readImageSize, uploadCover } from "../api";
import { CAPTION_LANGS } from "../mapConfig";
import { pushToast } from "../toast";
import {
  TOON_VISIBILITY,
  emptyDescriptionMap,
  parseDescriptionMap,
  visibilityFromStatus,
  statusFromVisibility,
  visibilityLabel,
  type DescriptionMap,
  type SeriesOption,
  type ToonRecord,
  type ToonVisibility,
} from "../types";
import EditorBar from "./EditorBar.vue";
import ToonCard from "./ToonCard.vue";

const route = useRoute();
const router = useRouter();

const isCreate = computed(() => route.name === "new" || !route.params.id);

const slug = ref("");
const slugTouched = ref(false);
const title = ref("");
const lastDerivedSlug = ref("");
const subtitle = ref("");
const descriptions = reactive<DescriptionMap>(emptyDescriptionMap());
const visibility = ref<ToonVisibility>("draft");
const seriesList = ref<SeriesOption[]>([]);
const seriesKey = ref("");
const episodeN = ref("");
const coverPreview = ref("");
const coverFile = ref<File | null>(null);
const existing = ref<ToonRecord | null>(null);
const saving = ref(false);

const previewCue = computed(() => visibilityLabel(statusFromVisibility(visibility.value)));
const previewPages = computed(() => existing.value?.pages.length ?? 0);

function slugFromTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

watch(
  () => title.value,
  (value) => {
    if (!isCreate.value || slugTouched.value) return;
    const next = slugFromTitle(value);
    if (!slug.value || slug.value === lastDerivedSlug.value) slug.value = next;
    lastDerivedSlug.value = next;
  }
);

async function loadToon(id: string): Promise<void> {
  try {
    const toon = await getToon(id);
    existing.value = toon;
    slug.value = toon.slug;
    title.value = toon.title;
    subtitle.value = toon.subtitle;
    Object.assign(descriptions, parseDescriptionMap(toon.descriptions, toon.description));
    visibility.value = visibilityFromStatus(toon.status);
    seriesKey.value = toon.seriesKey || "";
    episodeN.value = toon.episodeN != null ? String(toon.episodeN) : "";
    coverPreview.value = toon.coverUrl || "";
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Failed to load");
  }
}

watch(
  () => String(route.params.id || ""),
  (id) => {
    if (isCreate.value || !id) return;
    void loadToon(id);
  },
  { immediate: true }
);

function applyCreateQuery(): void {
  if (!isCreate.value) return;
  const series = String(route.query.series || "").trim();
  const episode = String(route.query.episode || "").trim();
  if (series) seriesKey.value = series;
  if (episode) episodeN.value = episode;
}

onMounted(async () => {
  try {
    seriesList.value = await listSeries();
  } catch {
    seriesList.value = [];
  }
  applyCreateQuery();
});

function episodePayload(): number | null {
  if (!seriesKey.value.trim()) return null;
  const n = Number(episodeN.value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
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
    let toon: ToonRecord;
    if (isCreate.value) {
      toon = await createToon({
        slug: slug.value.trim(),
        title: title.value.trim(),
        subtitle: subtitle.value.trim(),
        description: desc.en,
        descriptions: desc,
        status: statusFromVisibility(visibility.value),
        seriesKey: seriesKey.value.trim() || null,
        episodeN: episodePayload(),
      });
    } else {
      toon = await patchToon(String(route.params.id), {
        title: title.value.trim(),
        subtitle: subtitle.value.trim(),
        description: desc.en,
        descriptions: desc,
        status: statusFromVisibility(visibility.value),
        seriesKey: seriesKey.value.trim() || null,
        episodeN: episodePayload(),
      });
    }
    if (coverFile.value) {
      const size = await readImageSize(coverFile.value);
      toon = await uploadCover(toon.id, coverFile.value, size);
    }
    existing.value = toon;
    if (isCreate.value) await router.push(`/${toon.id}/pages`);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Save failed");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="editor-page">
    <EditorBar :title="isCreate ? 'New toon' : 'Toon'">
      <template #actions>
        <button class="editor-btn" type="submit" form="toon-meta" :disabled="saving">
          {{ saving ? "Saving…" : isCreate ? "Create" : "Save" }}
        </button>
        <RouterLink v-if="existing" class="editor-btn editor-btn--ghost" :to="`/${existing.id}/pages`">
          <Images :size="16" :stroke-width="1.4" aria-hidden="true" />
          Pages
        </RouterLink>
      </template>
    </EditorBar>
    <form id="toon-meta" class="editor-form" novalidate @submit="onSubmit">
      <div class="editor-form-main">
        <label v-if="isCreate" class="editor-form-span">
          Slug
          <input v-model="slug" name="slug" required autocomplete="off" @input="slugTouched = true" />
        </label>
        <p v-else class="editor-muted">Slug: {{ slug }}</p>

        <label>
          Title
          <input v-model="title" name="title" required />
        </label>
        <label>
          Subtitle
          <input v-model="subtitle" name="subtitle" />
        </label>
        <div class="editor-pair-row editor-form-span">
          <label>
            <span class="editor-label-row">
              Series
              <RouterLink class="editor-field-link" to="/series/new">New series</RouterLink>
            </span>
            <select v-model="seriesKey" name="series">
              <option value="">None (standalone)</option>
              <option v-for="item in seriesList" :key="item.key" :value="item.key">{{ item.title }}</option>
            </select>
          </label>
          <label>
            Episode
            <input
              v-model="episodeN"
              type="number"
              name="episode-n"
              min="1"
              step="1"
              placeholder="1"
              :disabled="!seriesKey"
            />
          </label>
        </div>
        <label v-for="lang in CAPTION_LANGS" :key="lang.code" class="editor-form-span">
          Description ({{ lang.label }})
          <textarea v-model="descriptions[lang.code]" :name="`description-${lang.code}`" :lang="lang.code" rows="4" />
        </label>
        <label>
          Visibility
          <select v-model="visibility" name="visibility">
            <option v-for="opt in TOON_VISIBILITY" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </label>
        <p class="editor-muted">
          {{
            visibility === "public"
              ? "Public toons appear on /toons/ and their reader loads from the database."
              : visibility === "staging"
                ? "Staging toons appear on staging.twentyseven.pictures and local preview. They stay hidden on production."
                : "Draft toons stay in the editor. They are hidden from the website."
          }}
        </p>
      </div>
      <aside class="editor-form-preview">
        <label>
          Cover image
          <input type="file" accept="image/webp,image/jpeg,image/png" @change="onCover" />
        </label>
        <div class="series-grid">
          <ToonCard
            :title="title.trim() || slug || 'Untitled'"
            :meta="subtitle.trim()"
            :cue="previewPages ? `${previewPages} pages` : ''"
            :description="descriptions.en.trim()"
            :cover-url="coverPreview || null"
            :badge="previewCue"
            :visibility="visibility"
          />
        </div>
      </aside>
    </form>
  </div>
</template>
