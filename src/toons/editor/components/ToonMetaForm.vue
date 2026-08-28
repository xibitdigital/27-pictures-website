<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { createToon, getToon, patchToon, readImageSize, uploadCover } from "../api";
import { CAPTION_LANGS } from "../mapConfig";
import {
  TOON_VISIBILITY,
  emptyDescriptionMap,
  parseDescriptionMap,
  visibilityFromStatus,
  statusFromVisibility,
  visibilityLabel,
  type DescriptionMap,
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
const coverPreview = ref("");
const coverFile = ref<File | null>(null);
const existing = ref<ToonRecord | null>(null);
const error = ref("");
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
    coverPreview.value = toon.coverUrl || "";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load";
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
    let toon: ToonRecord;
    if (isCreate.value) {
      toon = await createToon({
        slug: slug.value.trim(),
        title: title.value.trim(),
        subtitle: subtitle.value.trim(),
        description: desc.en,
        descriptions: desc,
        status: statusFromVisibility(visibility.value),
      });
    } else {
      toon = await patchToon(String(route.params.id), {
        title: title.value.trim(),
        subtitle: subtitle.value.trim(),
        description: desc.en,
        descriptions: desc,
        status: statusFromVisibility(visibility.value),
      });
    }
    if (coverFile.value) {
      const size = await readImageSize(coverFile.value);
      toon = await uploadCover(toon.id, coverFile.value, size);
    }
    await router.push(`/${toon.id}/pages`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Save failed";
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
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect
              x="2.5"
              y="3.5"
              width="8.5"
              height="11"
              rx="0.75"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
            />
            <path d="M5 2.5h8.5v11" fill="none" stroke="currentColor" stroke-width="1.4" />
          </svg>
          Pages
        </RouterLink>
      </template>
    </EditorBar>
    <form id="toon-meta" class="editor-form" novalidate @submit="onSubmit">
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
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
            :cue="previewPages ? `${previewCue} · ${previewPages} pages` : previewCue"
            :description="descriptions.en.trim()"
            :cover-url="coverPreview || null"
          />
        </div>
      </aside>
    </form>
  </div>
</template>
