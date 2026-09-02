<script setup lang="ts">
/** Generic yes/no dialog, styled like every other editor modal (GeneratePageDialog). */
import { nextTick, ref, watch } from "vue";

const props = withDefaults(
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

const rootEl = ref<HTMLElement | null>(null);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    await nextTick();
    rootEl.value?.focus();
  }
);

function stopPlate(ev: Event): void {
  ev.stopPropagation();
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="rootEl"
      class="editor-dialog-root"
      tabindex="-1"
      @keydown.escape.prevent="emit('cancel')"
      @pointerdown="stopPlate"
      @click="stopPlate"
    >
      <div class="editor-dialog-backdrop" @click="emit('cancel')" />
      <div
        class="editor-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        @pointerdown="stopPlate"
        @click="stopPlate"
      >
        <div class="editor-dialog-body">
          <h2 id="confirm-dialog-title">{{ title }}</h2>
          <p class="editor-muted">{{ message }}</p>
          <div class="editor-form-actions">
            <button class="editor-btn editor-btn--ghost" type="button" @click="emit('cancel')">
              {{ cancelLabel }}
            </button>
            <button class="editor-btn" type="button" @click="emit('confirm')">
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
