<script setup lang="ts">
import { ref } from "vue";
import { LoaderCircle, Upload, X } from "@lucide/vue";
import { RouterLink } from "vue-router";
import ConfirmDialog from "./ConfirmDialog.vue";
import type { PageRecord } from "../types";

defineProps<{
  toonId: string;
  pages: PageRecord[];
  activeId: string | null;
  canGenerate?: boolean;
  replacingId?: string | null;
}>();

const emit = defineEmits<{
  upload: [file: File];
  generate: [];
  remove: [pageId: string];
  replace: [pageId: string, file: File];
}>();

const pendingRemove = ref<PageRecord | null>(null);

function onFile(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("upload", file);
  input.value = "";
}

function onReplaceFile(ev: Event, page: PageRecord): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) emit("replace", page.id, file);
}

function onRemoveClick(ev: Event, page: PageRecord): void {
  ev.preventDefault();
  ev.stopPropagation();
  pendingRemove.value = page;
}

function onRemoveConfirm(): void {
  if (!pendingRemove.value) return;
  emit("remove", pendingRemove.value.id);
  pendingRemove.value = null;
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
      <label
        class="editor-thumb-replace"
        :class="{ 'is-busy': replacingId === page.id }"
        :title="replacingId === page.id ? 'Replacing…' : `Replace page ${page.position + 1}`"
        @click.stop
      >
        <LoaderCircle v-if="replacingId === page.id" class="editor-spin" :size="12" aria-hidden="true" />
        <Upload v-else :size="12" :stroke-width="2.25" aria-hidden="true" />
        <input
          type="file"
          accept="image/webp,image/jpeg,image/png"
          :aria-label="`Replace page ${page.position + 1}`"
          :disabled="replacingId === page.id"
          hidden
          @change="onReplaceFile($event, page)"
        />
      </label>
      <button
        class="editor-thumb-remove"
        type="button"
        :aria-label="`Delete page ${page.position + 1}`"
        :title="`Delete page ${page.position + 1}`"
        @click="onRemoveClick($event, page)"
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
  <ConfirmDialog
    :open="Boolean(pendingRemove)"
    title="Delete page"
    :message="pendingRemove ? `Delete page ${pendingRemove.position + 1}? This also deletes its captions.` : ''"
    confirm-label="Delete"
    @confirm="onRemoveConfirm"
    @cancel="pendingRemove = null"
  />
</template>
