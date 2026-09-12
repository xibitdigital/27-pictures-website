<script setup lang="ts">
import { useUpdateCheck } from "../updateCheck";
import EditorButton from "./ui/EditorButton.vue";
import EditorDialog from "./ui/EditorDialog.vue";

const { available, dismiss, reload } = useUpdateCheck();
</script>

<template>
  <EditorDialog :open="available" title="Update available" @update:open="(open) => !open && dismiss()">
    <p class="editor-muted">A newer version of the editor has been deployed. Reload to pick it up.</p>
    <div class="editor-form-actions">
      <EditorButton variant="ghost" name="update-dismiss" @click="dismiss">Not now</EditorButton>
      <EditorButton name="update-reload" @click="reload">Reload</EditorButton>
    </div>
  </EditorDialog>
</template>
