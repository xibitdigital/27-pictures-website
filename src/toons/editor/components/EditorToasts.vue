<script setup lang="ts">
/** One shared toast stack for the whole editor — mounted once at the app root. */
import { X } from "@lucide/vue";
import { ToastClose, ToastDescription, ToastPortal, ToastProvider, ToastRoot, ToastViewport } from "reka-ui";
import { dismissToast, toasts } from "../toast";
</script>

<template>
  <ToastProvider>
    <ToastRoot
      v-for="t in toasts"
      :key="t.id"
      class="editor-toast"
      :class="`editor-toast--${t.kind}`"
      :duration="t.durationMs"
      @update:open="(open: boolean) => !open && dismissToast(t.id)"
    >
      <ToastDescription as="span">{{ t.message }}</ToastDescription>
      <ToastClose class="editor-toast-close" aria-label="Dismiss">
        <X :size="14" aria-hidden="true" />
      </ToastClose>
    </ToastRoot>

    <ToastPortal to="body">
      <ToastViewport class="editor-toasts" />
    </ToastPortal>
  </ToastProvider>
</template>
