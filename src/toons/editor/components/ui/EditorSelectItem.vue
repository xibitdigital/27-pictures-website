<script setup lang="ts">
import { Check } from "@lucide/vue";
import { SelectItem, SelectItemIndicator, SelectItemText } from "reka-ui";
import { toInternalValue } from "./selectSentinel";

const props = defineProps<{
  value: string;
  disabled?: boolean;
}>();
</script>

<template>
  <SelectItem class="editor-select-item" :value="toInternalValue(props.value)" :disabled="disabled">
    <SelectItemText><slot /></SelectItemText>
    <SelectItemIndicator class="editor-select-item-indicator">
      <Check :size="14" :stroke-width="3" aria-hidden="true" />
    </SelectItemIndicator>
  </SelectItem>
</template>
