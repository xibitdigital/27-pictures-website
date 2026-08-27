<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { createToon, getToon, patchToon, readImageSize, uploadCover } from "../api";
import type { ToonRecord } from "../types";
import EditorSession from "./EditorSession.vue";

const route = useRoute();
const router = useRouter();

const isCreate = computed(() => route.name === "new" || !route.params.id);

const slug = ref("");
const slugTouched = ref(false);
const title = ref("");
const lastDerivedSlug = ref("");
const subtitle = ref("");
const description = ref("");
const coverPreview = ref("");
const coverFile = ref<File | null>(null);
const existing = ref<ToonRecord | null>(null);
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
    if (!isCreate.value || slugTouched.value) return;
    const next = slugFromTitle(value);
    if (!slug.value || slug.value === lastDerivedSlug.value) slug.value = next;
    lastDerivedSlug.value = next;
  }
);

onMounted(async () => {
  if (isCreate.value) return;
  const id = String(route.params.id);
  try {
    const toon = await getToon(id);
    existing.value = toon;
    slug.value = toon.slug;
    title.value = toon.title;
    subtitle.value = toon.subtitle;
    description.value = toon.description;
    coverPreview.value = toon.coverUrl || "";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load";
  }
});

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
    let toon: ToonRecord;
    if (isCreate.value) {
      toon = await createToon({
        slug: slug.value.trim(),
        title: title.value.trim(),
        subtitle: subtitle.value.trim(),
        description: description.value.trim(),
      });
    } else {
      toon = await patchToon(String(route.params.id), {
        title: title.value.trim(),
        subtitle: subtitle.value.trim(),
        description: description.value.trim(),
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
  <form class="editor-form" novalidate @submit="onSubmit">
    <header class="editor-list-head">
      <h1>{{ isCreate ? "New toon" : "Toon" }}</h1>
      <span class="editor-form-actions">
        <EditorSession />
        <RouterLink class="editor-btn editor-btn--ghost" to="/">All toons</RouterLink>
      </span>
    </header>

    <label v-if="isCreate">
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
    <label>
      Description
      <textarea v-model="description" name="description" rows="6" />
    </label>
    <label>
      Cover image
      <input type="file" accept="image/webp,image/jpeg,image/png" @change="onCover" />
    </label>
    <img v-if="coverPreview" class="editor-cover-preview" :src="coverPreview" alt="" />

    <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
    <div class="editor-form-actions">
      <button class="editor-btn" type="submit" :disabled="saving">
        {{ saving ? "Saving…" : isCreate ? "Create" : "Save" }}
      </button>
      <RouterLink v-if="existing" class="editor-btn editor-btn--ghost" :to="`/${existing.id}/pages`">
        Pages
      </RouterLink>
    </div>
  </form>
</template>
