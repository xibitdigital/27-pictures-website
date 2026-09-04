<script setup lang="ts">
import { Library } from "@lucide/vue";
import { RouterLink } from "vue-router";
import EditorSession from "./EditorSession.vue";

withDefaults(
  defineProps<{
    title: string;
    /** List page is already home — hide the All toons link. */
    home?: boolean;
  }>(),
  { home: true }
);
</script>

<template>
  <header class="editor-bar">
    <div class="editor-bar-start">
      <slot name="start" />
      <h1>{{ title }}</h1>
    </div>
    <div class="editor-bar-end">
      <div class="editor-bar-actions">
        <slot name="actions" />
      </div>
      <RouterLink v-if="home" class="editor-btn editor-btn--ghost" to="/">
        <Library :size="16" :stroke-width="1.4" aria-hidden="true" />
        All toons
      </RouterLink>
      <slot name="primary" />
      <EditorSession />
    </div>
  </header>
</template>
