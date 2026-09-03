<script setup lang="ts">
/**
 * Reka's Select, styled like the previous native `.editor-form select`.
 * `EditorSelectItem` children keep the same shape as `<option :value="…">` —
 * see selectSentinel.ts for the empty-string "None" option workaround.
 */
import { ChevronDown } from "@lucide/vue";
import {
  SelectContent,
  SelectIcon,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";
import { toExternalValue, toInternalValue } from "./selectSentinel";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    name?: string;
    ariaLabel?: string;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  { placeholder: "" }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <SelectRoot
    :model-value="toInternalValue(props.modelValue)"
    @update:model-value="(value) => emit('update:modelValue', toExternalValue(value as string | undefined))"
  >
    <SelectTrigger class="editor-select-trigger" :name="name" :aria-label="ariaLabel" :disabled="disabled">
      <SelectValue :placeholder="placeholder" />
      <SelectIcon class="editor-select-icon">
        <ChevronDown :size="16" aria-hidden="true" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="editor-select-content" position="popper" :side-offset="4">
        <SelectViewport class="editor-select-viewport">
          <slot />
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
