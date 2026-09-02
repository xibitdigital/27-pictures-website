<script setup lang="ts">
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
      <slot name="actions" />
      <RouterLink v-if="home" class="editor-btn editor-btn--ghost" to="/">All toons</RouterLink>
      <EditorSession />
    </div>
  </header>
</template>
