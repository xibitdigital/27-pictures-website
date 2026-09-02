<script setup lang="ts">
import { RouterView } from "vue-router";
import AuthGate from "./AuthGate.vue";
import EditorToasts from "./components/EditorToasts.vue";
</script>

<template>
  <AuthGate>
    <div class="editor-shell">
      <RouterView />
    </div>
  </AuthGate>
  <EditorToasts />
</template>
