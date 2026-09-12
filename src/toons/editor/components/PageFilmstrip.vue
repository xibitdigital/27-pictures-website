<script setup lang="ts">
import { nextTick, ref } from "vue";
import { Images, LayoutGrid, LoaderCircle, Plus, Upload, WandSparkles, X } from "@lucide/vue";
import { RouterLink } from "vue-router";
import ConfirmDialog from "./ConfirmDialog.vue";
import EditorChoiceCard from "./ui/EditorChoiceCard.vue";
import EditorDialog from "./ui/EditorDialog.vue";
import type { PageRecord } from "../types";

const props = defineProps<{
  toonId: string;
  pages: PageRecord[];
  activeId: string | null;
  canGenerate?: boolean;
  replacingId?: string | null;
}>();

const emit = defineEmits<{
  upload: [file: File];
  generate: [];
  layout: [];
  gallery: [];
  remove: [pageId: string];
  replace: [pageId: string, file: File];
  /** Every page id, in the new desired order — the whole list, not just the moved one. */
  reorderPages: [order: string[]];
}>();

const pendingRemove = ref<PageRecord | null>(null);
const addOpen = ref(false);
const pageFile = ref<HTMLInputElement | null>(null);

const draggedId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);

function onDragStart(ev: DragEvent, page: PageRecord): void {
  draggedId.value = page.id;
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/plain", page.id);
  }
}

function onDragOver(ev: DragEvent, page: PageRecord): void {
  if (!draggedId.value || draggedId.value === page.id) return;
  ev.preventDefault(); // required to allow a drop
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
  dragOverId.value = page.id;
}

function onDragLeave(page: PageRecord): void {
  if (dragOverId.value === page.id) dragOverId.value = null;
}

function onDrop(ev: DragEvent, page: PageRecord): void {
  ev.preventDefault();
  const sourceId = draggedId.value || ev.dataTransfer?.getData("text/plain") || null;
  dragOverId.value = null;
  draggedId.value = null;
  if (!sourceId || sourceId === page.id) return;
  const ids = props.pages.map((p) => p.id);
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(page.id);
  if (from === -1 || to === -1) return;
  ids.splice(to, 0, ...ids.splice(from, 1));
  emit("reorderPages", ids);
}

function onDragEnd(): void {
  draggedId.value = null;
  dragOverId.value = null;
}

function onFile(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("upload", file);
  input.value = "";
}

async function onUploadPick(): Promise<void> {
  addOpen.value = false;
  await nextTick();
  pageFile.value?.click();
}

function onGeneratePick(): void {
  addOpen.value = false;
  emit("generate");
}

function onLayoutPick(): void {
  addOpen.value = false;
  emit("layout");
}

function onGalleryPick(): void {
  addOpen.value = false;
  emit("gallery");
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
      :class="{
        'is-active': page.id === activeId,
        'is-dragging': draggedId === page.id,
        'is-drag-over': dragOverId === page.id,
      }"
      :to="`/${toonId}/pages/${page.id}`"
      draggable="true"
      @dragstart="onDragStart($event, page)"
      @dragover="onDragOver($event, page)"
      @dragleave="onDragLeave(page)"
      @drop="onDrop($event, page)"
      @dragend="onDragEnd"
    >
      <img :src="page.fileUrl" :alt="`Page ${page.position + 1}`" draggable="false" />
      <span>{{ page.position + 1 }}</span>
      <label
        class="editor-thumb-replace"
        :class="{ 'is-busy': replacingId === page.id }"
        :title="replacingId === page.id ? 'Replacing…' : `Replace page ${page.position + 1}`"
        @click.stop
        @pointerdown.stop
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
        @pointerdown.stop
      >
        <X :size="12" :stroke-width="2.25" aria-hidden="true" />
      </button>
    </RouterLink>
    <div class="editor-filmstrip-add">
      <input
        ref="pageFile"
        type="file"
        accept="image/webp,image/jpeg,image/png"
        aria-label="Upload page"
        hidden
        @change="onFile"
      />
      <button
        class="editor-filmstrip-action"
        type="button"
        name="add-page"
        aria-label="Add page"
        aria-haspopup="dialog"
        :aria-expanded="addOpen"
        @click="addOpen = true"
      >
        <Plus :size="28" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>
  </nav>
  <EditorDialog :open="addOpen" title="Add page" @update:open="(next) => (addOpen = next)">
    <p class="editor-muted">Upload a plate, or generate one with AI if this series has a Comfy graph loaded.</p>
    <div class="editor-add-page-choices">
      <EditorChoiceCard name="add-page-upload" @click="onUploadPick">
        <Upload :size="22" :stroke-width="1.8" aria-hidden="true" />
        Upload
      </EditorChoiceCard>
      <EditorChoiceCard
        name="add-page-generate"
        :title="
          props.canGenerate
            ? 'Generate page with the series Comfy graph'
            : 'Upload a Comfy flow and sheets on the series first'
        "
        @click="onGeneratePick"
      >
        <WandSparkles :size="22" :stroke-width="1.8" aria-hidden="true" />
        Generate
      </EditorChoiceCard>
      <EditorChoiceCard
        name="add-page-layout"
        title="Draw shapes on a blank page, then fill each with an image"
        @click="onLayoutPick"
      >
        <LayoutGrid :size="22" :stroke-width="1.8" aria-hidden="true" />
        Layout
      </EditorChoiceCard>
      <EditorChoiceCard
        name="add-page-gallery"
        title="Reuse an image already generated or uploaded for this toon"
        @click="onGalleryPick"
      >
        <Images :size="22" :stroke-width="1.8" aria-hidden="true" />
        Gallery
      </EditorChoiceCard>
    </div>
  </EditorDialog>
  <ConfirmDialog
    :open="Boolean(pendingRemove)"
    title="Delete page"
    :message="pendingRemove ? `Delete page ${pendingRemove.position + 1}? This also deletes its captions.` : ''"
    confirm-label="Delete"
    @confirm="onRemoveConfirm"
    @cancel="pendingRemove = null"
  />
</template>
