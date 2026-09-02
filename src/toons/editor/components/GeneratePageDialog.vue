<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { SeriesGenerateConfig } from "../types";

const props = defineProps<{
  open: boolean;
  generate: SeriesGenerateConfig | null;
  hasPrevious: boolean;
  busy: boolean;
  status: string;
  error: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { prompt: string; includePrevious: boolean }];
}>();

const prompt = ref("");
const includePrevious = ref(true);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    includePrevious.value = props.hasPrevious;
  }
);

const missingSheets = computed(() =>
  (props.generate?.slots || []).filter((slot) => slot.kind === "sheet" && !slot.fileKey)
);

const missingPrevious = computed(
  () =>
    includePrevious.value &&
    (props.generate?.slots || []).some((slot) => slot.kind === "previous") &&
    !props.hasPrevious
);

const canSubmit = computed(
  () => Boolean(prompt.value.trim()) && !props.busy && !missingSheets.value.length && !missingPrevious.value
);

function onSubmit(): void {
  if (!canSubmit.value) return;
  emit("submit", { prompt: prompt.value.trim(), includePrevious: includePrevious.value && props.hasPrevious });
}
</script>

<template>
  <dialog class="editor-dialog" :open="open" @cancel.prevent="emit('close')">
    <form class="editor-dialog-body" @submit.prevent="onSubmit">
      <h2>Generate page</h2>
      <p class="editor-muted">
        Uses this series’ Comfy graph and reference sheets. Upload still works from the plus card.
      </p>
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
      <label>
        Prompt
        <textarea
          name="generate-prompt"
          v-model="prompt"
          rows="6"
          required
          :disabled="busy"
          placeholder="What happens on this page (no balloons, no SFX lettering)"
        />
      </label>
      <label v-if="generate?.slots.some((s) => s.kind === 'previous')" class="editor-check">
        <input v-model="includePrevious" type="checkbox" name="include-previous" :disabled="busy || !hasPrevious" />
        Include previous page
      </label>
      <ul class="editor-dialog-slots">
        <li v-for="slot in generate?.slots || []" :key="slot.alias">
          {{ slot.label || slot.alias }}
          <span v-if="slot.kind === 'previous'" class="editor-muted">{{
            hasPrevious && includePrevious ? "last plate" : "skipped"
          }}</span>
          <span v-else-if="slot.fileUrl" class="editor-muted">ready</span>
          <span v-else class="editor-error">missing sheet</span>
        </li>
      </ul>
      <p v-if="busy" class="editor-muted">{{ status || "Generating page…" }}</p>
      <div class="editor-form-actions">
        <button class="editor-btn editor-btn--ghost" type="button" :disabled="busy" @click="emit('close')">
          Cancel
        </button>
        <button class="editor-btn" type="submit" :disabled="!canSubmit">
          {{ busy ? "Generating…" : "Generate" }}
        </button>
      </div>
    </form>
  </dialog>
</template>
