<script setup lang="ts">
/**
 * Thin shell around Reka's Dialog primitives, styled with the editor's
 * existing `.editor-dialog*` classes (unchanged) so every consumer keeps its
 * own body markup untouched. Replaces the hand-rolled Teleport + backdrop +
 * Escape-key + manual-focus scaffolding that ConfirmDialog and
 * GeneratePageDialog used to duplicate — Reka's DialogContent gives a real
 * focus trap and return-focus-on-close for free.
 *
 * `open` is fully controlled by the caller: Escape / outside-click / the
 * built-in dismiss behavior only emit `update:open` with `false` — the
 * caller decides whether to actually act on it (e.g. GeneratePageDialog
 * ignores it while a generate request is in flight).
 */
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    /** ConfirmDialog wants the stronger "alertdialog" role; everything else is a plain dialog. */
    alertdialog?: boolean;
  }>(),
  { alertdialog: false }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  openAutoFocus: [event: Event];
}>();
</script>

<template>
  <DialogRoot :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogPortal>
      <DialogOverlay class="editor-dialog-backdrop" />
      <DialogContent
        class="editor-dialog-root"
        :role="alertdialog ? 'alertdialog' : undefined"
        :aria-describedby="undefined"
        @open-auto-focus="emit('openAutoFocus', $event)"
      >
        <div class="editor-dialog">
          <div class="editor-dialog-body">
            <DialogTitle as="h2">{{ title }}</DialogTitle>
            <slot />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
