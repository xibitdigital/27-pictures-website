<script setup lang="ts">
import { Library } from "@lucide/vue";
import EditorSession from "./EditorSession.vue";
import EditorButton from "./ui/EditorButton.vue";
import EditorVisibilityBadge from "./ui/EditorVisibilityBadge.vue";

withDefaults(
  defineProps<{
    title: string;
    /** List page is already home — hide the All toons link. */
    home?: boolean;
    badge?: string;
    visibility?: string;
  }>(),
  { home: true, badge: "", visibility: "" }
);
</script>

<template>
  <header class="editor-bar">
    <div class="editor-bar-start">
      <slot name="start" />
      <h1>{{ title }}</h1>
      <EditorVisibilityBadge v-if="badge" :label="badge" :visibility="visibility" />
      <slot name="after-title" />
    </div>
    <div class="editor-bar-end">
      <div class="editor-bar-actions">
        <slot name="actions" />
      </div>
      <EditorButton v-if="home" variant="ghost" to="/">
        <Library :size="16" :stroke-width="1.4" aria-hidden="true" />
        All toons
      </EditorButton>
      <slot name="primary" />
      <EditorSession />
    </div>
  </header>
</template>
