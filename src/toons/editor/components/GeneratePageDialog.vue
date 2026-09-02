<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
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

const dialogEl = ref<HTMLDialogElement | null>(null);
const prompt = ref("");
const includePrevious = ref(true);

async function syncOpen(open: boolean): Promise<void> {
  await nextTick();
  const dialog = dialogEl.value;
  if (!dialog) return;
  if (open) {
    includePrevious.value = props.hasPrevious;
    if (!dialog.open) dialog.showModal();
    return;
  }
  if (dialog.open) dialog.close();
}

watch(() => props.open, syncOpen);
onMounted(() => {
  if (props.open) void syncOpen(true);
});

function onCancel(): void {
  if (props.busy) return;
  emit("close");
}

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
  () =>
    Boolean(props.generate?.flowKey) &&
    Boolean(prompt.value.trim()) &&
    !props.busy &&
    !missingSheets.value.length &&
    !missingPrevious.value
);

function onSubmit(): void {
  if (!canSubmit.value) return;
  emit("submit", { prompt: prompt.value.trim(), includePrevious: includePrevious.value && props.hasPrevious });
}
</script>

<template>
  <dialog ref="dialogEl" class="editor-dialog" @cancel.prevent="onCancel">
    <form class="editor-dialog-body" @submit.prevent="onSubmit">
      <h2>Generate page</h2>
      <p class="editor-muted">Uses this series’ Comfy graph and reference sheets.</p>
      <p v-if="!generate?.flowKey" class="editor-error" role="alert">
        Upload a Comfy Save-API graph and reference sheets on the series first.
      </p>
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
      <label>
        Prompt
        <textarea
          name="generate-prompt"
          v-model="prompt"
          rows="8"
          required
          :disabled="busy"
          placeholder="What happens on this page (no balloons, no SFX lettering)"
        />
      </label>
      <label v-if="generate?.slots.some((s) => s.kind === 'previous')" class="editor-check">
        <input v-model="includePrevious" type="checkbox" name="include-previous" :disabled="busy || !hasPrevious" />
        Include previous page
      </label>
      <ul v-if="generate?.slots.length" class="editor-dialog-slots">
        <li v-for="slot in generate.slots" :key="slot.alias">
          <span>{{ slot.label || slot.alias }}</span>
          <span v-if="slot.kind === 'previous'" class="editor-muted">{{
            hasPrevious && includePrevious ? "last plate" : "skipped"
          }}</span>
          <span v-else-if="slot.fileUrl" class="editor-muted">ready</span>
          <span v-else class="editor-error">missing sheet</span>
        </li>
      </ul>
      <p v-if="busy" class="editor-muted">{{ status || "Generating page…" }}</p>
      <div class="editor-form-actions">
        <button class="editor-btn editor-btn--ghost" type="button" :disabled="busy" @click="onCancel">Cancel</button>
        <button class="editor-btn" type="submit" :disabled="!canSubmit">
          {{ busy ? "Generating…" : "Generate" }}
        </button>
      </div>
    </form>
  </dialog>
</template>
