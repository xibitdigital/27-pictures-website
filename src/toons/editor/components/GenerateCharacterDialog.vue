<script setup lang="ts">
import { LoaderCircle } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { listRunComfyModels } from "../api";
import type { CharacterProvider, RunComfyModel } from "../types";
import EditorDialog from "./ui/EditorDialog.vue";
import EditorSelect from "./ui/EditorSelect.vue";
import EditorSelectItem from "./ui/EditorSelectItem.vue";

const props = defineProps<{
  open: boolean;
  slotLabel: string;
  provider: CharacterProvider;
  /** The series' own model — reused as-is for Runware (its models already work with or without
   * reference images, so no second dropdown is needed there; see CLAUDE.md's TypeScript
   * Guidelines worked example for why this stays one lookup instead of a duplicated list). */
  runwareModel: string;
  busy: boolean;
  status: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { prompt: string; model: string }];
}>();

const prompt = ref("");
const runComfyModels = ref<RunComfyModel[]>([]);
const runComfyModelsLoading = ref(false);
const runComfyModelsError = ref("");
const runComfyModel = ref("");

async function ensureRunComfyModelsLoaded(): Promise<void> {
  if (runComfyModels.value.length || runComfyModelsLoading.value) return;
  runComfyModelsLoading.value = true;
  runComfyModelsError.value = "";
  try {
    runComfyModels.value = await listRunComfyModels("text-to-image");
    if (runComfyModels.value.length) runComfyModel.value = runComfyModels.value[0].id;
  } catch (err) {
    runComfyModelsError.value = err instanceof Error ? err.message : "Could not load RunComfy models";
  } finally {
    runComfyModelsLoading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    prompt.value = "";
    if (props.provider === "runcomfy") void ensureRunComfyModelsLoaded();
  }
);

const model = computed(() => (props.provider === "runcomfy" ? runComfyModel.value : props.runwareModel));
const canSubmit = computed(() => Boolean(prompt.value.trim()) && Boolean(model.value.trim()) && !props.busy);

function onCancel(): void {
  if (props.busy) return;
  emit("close");
}

function onSubmit(): void {
  if (!canSubmit.value) return;
  emit("submit", { prompt: prompt.value.trim(), model: model.value.trim() });
}
</script>

<template>
  <EditorDialog :open="open" title="Generate character" wide hide-close @update:open="(next) => !next && onCancel()">
    <form class="editor-dialog-form" @submit.prevent="onSubmit">
      <p class="editor-muted">
        Generates a text-to-image character for the “{{ slotLabel }}” slot — no reference images are sent, only the
        description below. The result is saved to this series' character gallery and assigned to the slot automatically.
      </p>
      <label>
        Description
        <textarea
          name="character-prompt"
          v-model="prompt"
          rows="8"
          cols="40"
          required
          :disabled="busy"
          placeholder="Who this character is, appearance, pose, framing…"
        />
      </label>
      <label v-if="provider === 'runcomfy'" class="editor-form-span">
        RunComfy model
        <EditorSelect
          v-model="runComfyModel"
          name="character-model"
          aria-label="RunComfy text-to-image model"
          :disabled="busy"
        >
          <EditorSelectItem v-for="m in runComfyModels" :key="m.id" :value="m.id">{{ m.label }}</EditorSelectItem>
        </EditorSelect>
        <p v-if="runComfyModelsLoading" class="editor-muted">Loading RunComfy's text-to-image catalog…</p>
        <p v-else-if="runComfyModelsError" class="editor-error">{{ runComfyModelsError }}</p>
      </label>
      <p v-if="busy" class="editor-muted">{{ status || "Generating character…" }}</p>
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
