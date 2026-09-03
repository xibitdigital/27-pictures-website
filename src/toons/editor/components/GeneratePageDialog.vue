<script setup lang="ts">
import { LoaderCircle } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import type { SeriesGenerateConfig } from "../types";
import EditorCheckbox from "./ui/EditorCheckbox.vue";
import EditorDialog from "./ui/EditorDialog.vue";

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
  submit: [payload: { prompt: string; includePrevious: boolean; previousFile: File | null }];
}>();

const prompt = ref("");
const includePrevious = ref(true);
const previousFile = ref<File | null>(null);
const previousFileInput = ref<HTMLInputElement | null>(null);

const hasPreviousSlot = computed(() => (props.generate?.slots || []).some((s) => s.kind === "previous"));

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    includePrevious.value = props.hasPrevious;
    previousFile.value = null;
    if (previousFileInput.value) previousFileInput.value.value = "";
  }
);

function onCancel(): void {
  if (props.busy) return;
  emit("close");
}

function onPreviousFile(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  previousFile.value = input.files?.[0] || null;
}

const missingSheets = computed(() =>
  (props.generate?.slots || []).filter((slot) => slot.kind === "sheet" && !slot.optional && !slot.fileKey)
);

const missingPrevious = computed(
  () => includePrevious.value && hasPreviousSlot.value && !props.hasPrevious && !previousFile.value
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
  emit("submit", {
    prompt: prompt.value.trim(),
    includePrevious: includePrevious.value && props.hasPrevious,
    previousFile: previousFile.value,
  });
}
</script>

<template>
  <EditorDialog :open="open" title="Generate page" @update:open="(next) => !next && onCancel()">
    <form class="editor-dialog-form" @submit.prevent="onSubmit">
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
      <template v-if="hasPreviousSlot">
        <EditorCheckbox
          :checked="includePrevious"
          name="include-previous"
          :disabled="busy || !hasPrevious"
          @update:checked="(v) => (includePrevious = v)"
        >
          Include previous page
        </EditorCheckbox>
        <label>
          Or attach a specific image for the previous-plate slot
          <input
            ref="previousFileInput"
            type="file"
            name="previous-file"
            accept="image/webp,image/jpeg,image/png"
            :disabled="busy"
            @change="onPreviousFile"
          />
        </label>
        <p v-if="previousFile" class="editor-muted">Using {{ previousFile.name }} instead of the last plate.</p>
      </template>
      <ul v-if="generate?.slots.length" class="editor-dialog-slots">
        <li v-for="slot in generate.slots" :key="slot.alias">
          <span>{{ slot.label || slot.alias }}</span>
          <span v-if="slot.kind === 'previous'" class="editor-muted">{{
            previousFile ? "custom file" : hasPrevious && includePrevious ? "last plate" : "skipped"
          }}</span>
          <span v-else-if="slot.fileUrl" class="editor-muted">ready</span>
          <span v-else-if="slot.optional" class="editor-muted">optional — skipped</span>
          <span v-else class="editor-error">missing sheet</span>
        </li>
      </ul>
      <p v-if="busy" class="editor-muted">{{ status || "Generating page…" }}</p>
      <div class="editor-form-actions">
        <button class="editor-btn editor-btn--ghost" type="button" :disabled="busy" @click="onCancel">Cancel</button>
        <button class="editor-btn" type="submit" :class="{ 'is-busy': busy }" :disabled="!canSubmit">
          <LoaderCircle v-if="busy" class="editor-spin" :size="16" aria-hidden="true" />
          {{ busy ? "Generating…" : "Generate" }}
        </button>
      </div>
    </form>
  </EditorDialog>
</template>
