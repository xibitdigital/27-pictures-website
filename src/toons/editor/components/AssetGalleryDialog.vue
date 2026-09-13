<script setup lang="ts">
/**
 * Every image ever generated or uploaded for this toon — including ones no page or region uses
 * any more (see toon_assets in the Worker). Lets a page or region reuse one instead of
 * re-uploading or re-generating it. Defaults to shape/area fills (the common case — reusing a
 * character or object already cut for a panel); the tabs switch to whole plates.
 */
import { computed, ref, watch } from "vue";
import { listToonAssets } from "../api";
import { pushToast } from "../toast";
import type { ToonAsset, ToonAssetSource } from "../types";
import EditorChipFilter from "./ui/EditorChipFilter.vue";
import EditorDialog from "./ui/EditorDialog.vue";
import EditorPlatePicker from "./ui/EditorPlatePicker.vue";

const props = defineProps<{ open: boolean; toonId: string }>();

const emit = defineEmits<{
  close: [];
  pick: [asset: ToonAsset];
}>();

const TABS: { value: ToonAssetSource; label: string }[] = [
  { value: "region", label: "Shapes" },
  { value: "page", label: "Pages" },
];

const activeTab = ref<ToonAssetSource>("region");
const assets = ref<ToonAsset[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    assets.value = await listToonAssets(props.toonId, activeTab.value);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not load the gallery");
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    activeTab.value = "region";
    void load();
  },
  { immediate: true }
);

watch(activeTab, () => {
  if (props.open) void load();
});

const isEmpty = computed(() => !loading.value && !assets.value.length);

const pickerItems = computed(() =>
  assets.value.map((asset) => ({
    key: asset.id,
    src: asset.url,
    label: `Image from ${asset.createdAt}`,
  }))
);

function onPick(key: string): void {
  const asset = assets.value.find((item) => item.id === key);
  if (asset) emit("pick", asset);
}
</script>

<template>
  <EditorDialog :open="open" title="Choose from gallery" wide @update:open="(next) => !next && emit('close')">
    <EditorChipFilter
      :options="TABS"
      v-model="activeTab"
      role="tablist"
      ariaLabel="Image kind"
      name-prefix="gallery-tab-"
    />
    <p class="editor-muted">
      {{
        activeTab === "region"
          ? "Every shape/area image generated or uploaded for this toon, including ones no shape uses any more."
          : "Every plate generated or uploaded for this toon, including ones not on a page any more."
      }}
    </p>
    <p v-if="loading">Loading…</p>
    <p v-else-if="isEmpty" class="editor-muted">No images yet — generate or upload one first.</p>
    <EditorPlatePicker
      v-else
      class="editor-asset-gallery"
      :items="pickerItems"
      ariaLabel="Toon image gallery"
      @pick="onPick"
    />
  </EditorDialog>
</template>
