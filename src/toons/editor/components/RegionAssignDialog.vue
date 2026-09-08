<script setup lang="ts">
/**
 * Upload/Generate chooser for one Layout-mode region — same two-button
 * layout as PageFilmstrip's "Add page" dialog. Picking "Generate" hands off
 * to the studio's single shared GeneratePageDialog instance (scoped to this
 * region) rather than embedding a second copy of it.
 */
import { nextTick, ref } from "vue";
import { Upload, WandSparkles } from "@lucide/vue";
import EditorDialog from "./ui/EditorDialog.vue";

defineProps<{ open: boolean; canGenerate?: boolean }>();

const emit = defineEmits<{
  close: [];
  upload: [file: File];
  generate: [];
}>();

const fileInput = ref<HTMLInputElement | null>(null);

async function onUploadPick(): Promise<void> {
  await nextTick();
  fileInput.value?.click();
}

function onFile(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) emit("upload", file);
}

function onGeneratePick(): void {
  emit("generate");
}
</script>

<template>
  <EditorDialog :open="open" title="Region image" @update:open="(next) => !next && emit('close')">
    <p class="editor-muted">Upload an image, or generate one with AI, to fill this shape.</p>
    <input
      ref="fileInput"
      type="file"
      accept="image/webp,image/jpeg,image/png"
      aria-label="Upload region image"
      hidden
      @change="onFile"
    />
    <div class="editor-add-page-choices">
      <button class="editor-add-page-choice" type="button" name="region-upload" @click="onUploadPick">
        <Upload :size="22" :stroke-width="1.8" aria-hidden="true" />
        Upload
      </button>
      <button
        class="editor-add-page-choice"
        type="button"
        name="region-generate"
        :title="
          canGenerate ? 'Generate with the series Comfy graph' : 'Upload a Comfy flow and sheets on the series first'
        "
        @click="onGeneratePick"
      >
        <WandSparkles :size="22" :stroke-width="1.8" aria-hidden="true" />
        Generate
      </button>
    </div>
  </EditorDialog>
</template>
