<script setup lang="ts">
/**
 * Swatch + hex row (`.editor-color-row`) used by CaptionInspector lettering/stroke and
 * LayoutInspector page-bg/border — one wrapper instead of four copies of the two inputs.
 * Parse/persist stays in the caller; this only owns the markup and the row class.
 */
defineProps<{
  modelValue: string;
  swatch: string;
  name: string;
  swatchName: string;
  ariaLabel: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  picker: [event: Event];
  blur: [];
}>();
</script>

<template>
  <span class="editor-color-row">
    <input type="color" :name="swatchName" :value="swatch" :aria-label="ariaLabel" @input="emit('picker', $event)" />
    <input
      type="text"
      :name="name"
      :value="modelValue"
      placeholder="default"
      spellcheck="false"
      autocomplete="off"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="emit('blur')"
    />
  </span>
</template>
