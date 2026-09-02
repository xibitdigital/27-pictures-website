<script setup lang="ts">
import { X } from "@lucide/vue";
import { RouterLink } from "vue-router";
import type { PageRecord } from "../types";

defineProps<{
  toonId: string;
  pages: PageRecord[];
  activeId: string | null;
  canGenerate?: boolean;
}>();

const emit = defineEmits<{
  upload: [file: File];
  generate: [];
  remove: [pageId: string];
}>();

function onFile(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("upload", file);
  input.value = "";
}

function onRemove(ev: Event, page: PageRecord): void {
  ev.preventDefault();
  ev.stopPropagation();
  if (!window.confirm(`Delete page ${page.position + 1}? This also deletes its captions.`)) return;
  emit("remove", page.id);
}
</script>

<template>
  <nav class="editor-filmstrip" aria-label="Pages">
    <RouterLink
      v-for="page in pages"
      :key="page.id"
      class="editor-thumb"
      :class="{ 'is-active': page.id === activeId }"
      :to="`/${toonId}/pages/${page.id}`"
    >
      <img :src="page.fileUrl" :alt="`Page ${page.position + 1}`" />
      <span>{{ page.position + 1 }}</span>
      <button
        class="editor-thumb-remove"
        type="button"
        :aria-label="`Delete page ${page.position + 1}`"
        :title="`Delete page ${page.position + 1}`"
        @click="onRemove($event, page)"
      >
        <X :size="12" :stroke-width="2.25" aria-hidden="true" />
      </button>
    </RouterLink>
    <div class="editor-filmstrip-add-wrap">
      <div class="editor-filmstrip-add">
        <span class="editor-filmstrip-add-plus" aria-hidden="true">+</span>
        <span>Add page</span>
        <div class="editor-filmstrip-add-actions">
          <label class="editor-filmstrip-action">
            Upload
            <input type="file" accept="image/webp,image/jpeg,image/png" aria-label="Upload page" @change="onFile" />
          </label>
          <button
            class="editor-filmstrip-action"
            type="button"
            name="add-page-generate"
            :title="
              canGenerate
                ? 'Generate page with the series Comfy graph'
                : 'Upload a Comfy flow and sheets on the series first'
            "
            @click="emit('generate')"
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>
