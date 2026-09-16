<script setup lang="ts">
/**
 * Busy-status line + Cancel/Submit row shared by every "Generate" dialog (GeneratePageDialog,
 * GenerateCharacterDialog) — identical markup was duplicated in both. Submit is a native
 * `type="submit"` button; the caller's own `<form @submit.prevent="...">` still owns what
 * actually happens, this only renders the row and emits `cancel`.
 */
import { LoaderCircle } from "@lucide/vue";
import EditorButton from "./EditorButton.vue";

defineProps<{
  busy: boolean;
  status: string;
  /** Shown while busy if `status` (the live polled message) hasn't arrived yet. */
  defaultStatus: string;
  /** Submit button's label once idle — e.g. "Generate" or "Generate 3". While busy this always
   * shows "Generating…" instead, regardless of this prop. */
  submitLabel: string;
  canSubmit: boolean;
}>();

const emit = defineEmits<{ cancel: [] }>();
</script>

<template>
  <div class="editor-generate-footer">
    <p v-if="busy" class="editor-muted editor-generate-status">{{ status || defaultStatus }}</p>
    <div class="editor-form-actions">
      <slot />
      <EditorButton variant="ghost" :disabled="busy" @click="emit('cancel')">Cancel</EditorButton>
      <EditorButton type="submit" :class="{ 'is-busy': busy }" :disabled="!canSubmit">
        <LoaderCircle v-if="busy" class="editor-spin" :size="16" aria-hidden="true" />
        {{ busy ? "Generating…" : submitLabel }}
      </EditorButton>
    </div>
  </div>
</template>
