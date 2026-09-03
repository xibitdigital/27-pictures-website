<script setup lang="ts">
/** Reka's Checkbox, styled to match the previous native `.editor-check` box exactly. */
import { Check } from "@lucide/vue";
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";

defineProps<{
  checked: boolean;
  name?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:checked": [value: boolean];
}>();
</script>

<template>
  <label class="editor-check">
    <CheckboxRoot
      class="editor-checkbox-root"
      :model-value="checked"
      :name="name"
      :disabled="disabled"
      @update:model-value="(value: boolean | 'indeterminate') => emit('update:checked', value === true)"
    >
      <CheckboxIndicator class="editor-checkbox-indicator">
        <Check :size="12" :stroke-width="3" aria-hidden="true" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <slot />
  </label>
</template>
