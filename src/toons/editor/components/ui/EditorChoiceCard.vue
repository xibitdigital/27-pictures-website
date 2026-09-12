<script setup lang="ts">
/**
 * One tile in an "Upload / Generate / Layout / Gallery" picker (PageFilmstrip's "Add page"
 * dialog, RegionAssignDialog) — icon + label, `.editor-add-page-choice` styling shared instead of
 * every dialog repeating that class string, same reasoning as EditorButton.vue for `.editor-btn`.
 */
withDefaults(defineProps<{ type?: "button" | "submit" }>(), { type: "button" });
</script>

<template>
  <button :type="type" class="editor-add-page-choice">
    <slot />
  </button>
</template>
