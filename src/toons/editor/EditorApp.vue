<script setup lang="ts">
import { RouterView } from "vue-router";
import AuthGate from "./AuthGate.vue";
import EditorToasts from "./components/EditorToasts.vue";
import UpdateAvailableDialog from "./components/UpdateAvailableDialog.vue";
</script>

<template>
  <AuthGate>
    <div class="editor-shell">
      <RouterView />
    </div>
  </AuthGate>
  <EditorToasts />
  <UpdateAvailableDialog />
</template>
