<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { PageRecord } from "../types";

defineProps<{
  toonId: string;
  pages: PageRecord[];
  activeId: string | null;
}>();

const emit = defineEmits<{
  upload: [file: File];
}>();

function onFile(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("upload", file);
  input.value = "";
}
</script>

<template>
  <nav class="editor-filmstrip" aria-label="Pages">
    <label class="editor-filmstrip-add">
      <span class="editor-filmstrip-add-plus" aria-hidden="true">+</span>
      <span>Add page</span>
      <input type="file" accept="image/webp,image/jpeg,image/png" aria-label="Add page" @change="onFile" />
    </label>
    <RouterLink
      v-for="page in pages"
      :key="page.id"
      class="editor-thumb"
      :class="{ 'is-active': page.id === activeId }"
      :to="`/${toonId}/pages/${page.id}`"
    >
      <img :src="page.fileUrl" :alt="`Page ${page.position + 1}`" />
      <span>{{ page.position + 1 }}</span>
    </RouterLink>
  </nav>
</template>
