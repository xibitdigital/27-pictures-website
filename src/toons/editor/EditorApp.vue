<script setup lang="ts">
import { RouterView } from "vue-router";
import AuthGate from "./AuthGate.vue";
</script>

<template>
  <AuthGate>
    <div class="editor-shell">
      <RouterView />
    </div>
  </AuthGate>
</template>
