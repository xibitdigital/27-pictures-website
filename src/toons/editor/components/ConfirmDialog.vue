<script setup lang="ts">
/** Generic yes/no dialog, styled like every other editor modal (GeneratePageDialog). */
import EditorDialog from "./ui/EditorDialog.vue";

withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }>(),
  {
    title: "Confirm",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
  }
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <EditorDialog :open="open" :title="title" alertdialog @update:open="(next) => !next && emit('cancel')">
    <p class="editor-muted">{{ message }}</p>
    <div class="editor-form-actions">
      <button class="editor-btn editor-btn--ghost" type="button" @click="emit('cancel')">
        {{ cancelLabel }}
      </button>
      <button class="editor-btn" type="button" @click="emit('confirm')">
        {{ confirmLabel }}
      </button>
    </div>
  </EditorDialog>
</template>
