<script setup lang="ts">
import { useUpdateCheck } from "../updateCheck";
import EditorDialog from "./ui/EditorDialog.vue";

const { available, dismiss, reload } = useUpdateCheck();
</script>

<template>
  <EditorDialog :open="available" title="Update available" @update:open="(open) => !open && dismiss()">
    <p class="editor-muted">A newer version of the editor has been deployed. Reload to pick it up.</p>
    <div class="editor-form-actions">
      <button class="editor-btn editor-btn--ghost" type="button" name="update-dismiss" @click="dismiss">Not now</button>
      <button class="editor-btn" type="button" name="update-reload" @click="reload">Reload</button>
    </div>
  </EditorDialog>
</template>
