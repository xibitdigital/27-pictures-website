<script setup lang="ts">
/** One shared toast stack for the whole editor — mounted once at the app root. */
import { X } from "@lucide/vue";
import { dismissToast, toasts } from "../toast";
</script>

<template>
  <Teleport to="body">
    <div class="editor-toasts" role="status" aria-live="polite">
      <div v-for="t in toasts" :key="t.id" class="editor-toast" :class="`editor-toast--${t.kind}`">
        <span>{{ t.message }}</span>
        <button type="button" class="editor-toast-close" aria-label="Dismiss" @click="dismissToast(t.id)">
          <X :size="14" aria-hidden="true" />
        </button>
      </div>
    </div>
  </Teleport>
</template>
