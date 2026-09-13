<script setup lang="ts">
/**
 * Thumb grid (`.editor-plate-picker`) shared by GeneratePageDialog's previous-plate list and
 * AssetGalleryDialog. Gallery adds `.editor-asset-gallery` via class fallthrough on the root.
 */
export type EditorPlatePickerItem = {
  key: string;
  src?: string | null;
  label: string;
  badge?: string;
  selected?: boolean;
  disabled?: boolean;
};

defineProps<{
  items: EditorPlatePickerItem[];
  ariaLabel: string;
}>();

const emit = defineEmits<{
  pick: [key: string];
}>();
</script>

<template>
  <div class="editor-plate-picker" role="listbox" :aria-label="ariaLabel">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="editor-plate-picker-item"
      :class="{ 'is-selected': item.selected }"
      role="option"
      :aria-label="item.label"
      :aria-selected="item.selected || undefined"
      :disabled="item.disabled"
      @click="emit('pick', item.key)"
    >
      <img v-if="item.src" :src="item.src" alt="" />
      <span v-if="item.badge" class="editor-plate-picker-num">{{ item.badge }}</span>
    </button>
  </div>
</template>
