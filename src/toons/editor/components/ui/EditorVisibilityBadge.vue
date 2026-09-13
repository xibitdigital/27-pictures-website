<script setup lang="ts">
/**
 * Draft / Staging / Public chip. Same span in ToonCard and EditorBar — CSS keys off
 * `data-visibility`. Compact card sizing is a descendant rule on `.series-card--compact`.
 */
defineProps<{
  label: string;
  visibility?: string;
}>();
</script>

<template>
  <span class="editor-visibility-badge" :data-visibility="visibility || undefined">{{ label }}</span>
</template>
