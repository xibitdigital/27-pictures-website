<script setup lang="ts">
/**
 * @deprecated Import from `../bookReader/LangSwitcher.vue` (shared).
 * Thin re-export so older paths keep working.
 */
import type { WordOverlay } from "../../bookReader/words";
import SharedLangSwitcher from "../../bookReader/LangSwitcher.vue";

defineProps<{
  overlay: WordOverlay | null;
}>();

defineEmits<{
  change: [];
}>();
</script>

<template>
  <SharedLangSwitcher :overlay="overlay" @change="$emit('change')" />
</template>
