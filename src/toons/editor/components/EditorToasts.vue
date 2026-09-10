<script setup lang="ts">
/** One shared toast stack for the whole editor — mounted once at the app root. */
import { Copy, X } from "@lucide/vue";
import { ToastClose, ToastDescription, ToastPortal, ToastProvider, ToastRoot, ToastViewport } from "reka-ui";
import { dismissToast, toasts } from "../toast";

async function copyMessage(message: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(message);
  } catch {
    /* clipboard unavailable (permissions, insecure context) — nothing more to do */
  }
}
</script>

<template>
  <ToastProvider>
    <ToastRoot
      v-for="t in toasts"
      :key="t.id"
      class="editor-toast"
      :class="`editor-toast--${t.kind}`"
      :duration="t.kind === 'error' ? 0 : t.durationMs"
      @update:open="(open: boolean) => !open && dismissToast(t.id)"
    >
      <ToastDescription as="span">{{ t.message }}</ToastDescription>
      <button
        v-if="t.kind === 'error'"
        type="button"
        class="editor-toast-close"
        aria-label="Copy error message"
        @click="copyMessage(t.message)"
      >
        <Copy :size="14" aria-hidden="true" />
      </button>
      <ToastClose class="editor-toast-close" aria-label="Dismiss">
        <X :size="14" aria-hidden="true" />
      </ToastClose>
    </ToastRoot>

    <ToastPortal to="body">
      <ToastViewport class="editor-toasts" />
    </ToastPortal>
  </ToastProvider>
</template>
