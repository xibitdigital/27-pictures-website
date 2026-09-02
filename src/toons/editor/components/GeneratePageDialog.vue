<script setup lang="ts">
import { LoaderCircle } from "@lucide/vue";
import { computed, nextTick, ref, watch } from "vue";
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

const rootEl = ref<HTMLElement | null>(null);
const prompt = ref("");
const includePrevious = ref(true);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    includePrevious.value = props.hasPrevious;
    await nextTick();
    rootEl.value?.focus();
  }
);

function onCancel(): void {
  if (props.busy) return;
  emit("close");
}

function stopPlate(ev: Event): void {
  ev.stopPropagation();
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
  <Teleport to="body">
    <div
      v-if="open"
      ref="rootEl"
      class="editor-dialog-root"
      tabindex="-1"
      @keydown.escape.prevent="onCancel"
      @pointerdown="stopPlate"
      @click="stopPlate"
    >
      <div class="editor-dialog-backdrop" @click="onCancel" />
      <div
        class="editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-page-title"
        @pointerdown="stopPlate"
        @click="stopPlate"
      >
        <form class="editor-dialog-body" @submit.prevent="onSubmit">
          <h2 id="generate-page-title">Generate page</h2>
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
              cols="40"
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
            <button class="editor-btn editor-btn--ghost" type="button" :disabled="busy" @click="onCancel">
              Cancel
            </button>
            <button class="editor-btn" type="submit" :class="{ 'is-busy': busy }" :disabled="!canSubmit">
              <LoaderCircle v-if="busy" class="editor-spin" :size="16" aria-hidden="true" />
              {{ busy ? "Generating…" : "Generate" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
