<script setup lang="ts">
/** Generic yes/no dialog, styled like every other editor modal (GeneratePageDialog). */
import { nextTick, ref } from "vue";
import EditorButton from "./ui/EditorButton.vue";
import EditorDialog from "./ui/EditorDialog.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Focus the confirm button on open so Enter accepts immediately. */
    focusConfirm?: boolean;
  }>(),
  {
    title: "Confirm",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    focusConfirm: false,
  }
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const confirmEl = ref<InstanceType<typeof EditorButton> | null>(null);

async function onOpenAutoFocus(ev: Event): Promise<void> {
  if (!props.focusConfirm) return;
  ev.preventDefault();
  await nextTick();
  confirmEl.value?.focus();
}
</script>

<template>
  <EditorDialog
    :open="open"
    :title="title"
    alertdialog
    @update:open="(next) => !next && emit('cancel')"
    @open-auto-focus="onOpenAutoFocus"
  >
    <p class="editor-muted">{{ message }}</p>
    <div class="editor-form-actions">
      <EditorButton variant="ghost" @click="emit('cancel')">
        {{ cancelLabel }}
      </EditorButton>
      <EditorButton ref="confirmEl" variant="danger" name="confirm" @click="emit('confirm')">
        {{ confirmLabel }}
      </EditorButton>
    </div>
  </EditorDialog>
</template>
