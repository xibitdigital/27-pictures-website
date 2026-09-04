<script setup lang="ts">
import { Save, Settings2 } from "@lucide/vue";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import {
  addBubble,
  deleteBubble,
  deletePage,
  generatePage,
  getJob,
  getSeries,
  getToon,
  patchBubble,
  readImageSize,
  replacePage,
  uploadPage,
} from "../api";
import type { LangCode } from "../../bookReader/types";
import {
  visibilityFromStatus,
  visibilityLabel,
  type BubbleRecord,
  type SeriesGenerateConfig,
  type ToonRecord,
} from "../types";
import { mergeReplacedPage } from "../pageFile";
import LangSwitcher from "../../bookReader/LangSwitcher.vue";
import { bubbleWritePayload, CAPTION_LANGS } from "../mapConfig";
import { pushToast } from "../toast";
import CaptionInspector from "./CaptionInspector.vue";
import EditorBar from "./EditorBar.vue";
import GeneratePageDialog from "./GeneratePageDialog.vue";
import PageFilmstrip from "./PageFilmstrip.vue";
import PlateCanvas from "./PlateCanvas.vue";

const switchLangs = CAPTION_LANGS.map((l) => ({ code: l.code, label: l.code.toUpperCase() }));

const route = useRoute();
const router = useRouter();

const toon = ref<ToonRecord | null>(null);
const selectedId = ref<string | null>(null);
const previewLang = ref<LangCode>("en");
const loading = ref(true);
const saving = ref(false);
const replacingId = ref<string | null>(null);
const dirtyIds = ref(new Set<string>());
const seriesGenerate = ref<SeriesGenerateConfig | null>(null);
const generateOpen = ref(false);
const generateBusy = ref(false);
const generateStatus = ref("");
const generateError = ref("");

const toonId = computed(() => String(route.params.id || ""));
const pageId = computed(() => (route.params.pageId ? String(route.params.pageId) : null));

const activePage = computed(() => {
  if (!toon.value) return null;
  if (pageId.value) return toon.value.pages.find((p) => p.id === pageId.value) || null;
  return toon.value.pages[0] || null;
});

const selectedBubble = computed(() => {
  if (!activePage.value || !selectedId.value) return null;
  return activePage.value.bubbles.find((b) => b.id === selectedId.value) || null;
});

const dirtyCount = computed(() => dirtyIds.value.size);

const canGenerate = computed(() => {
  const generate = seriesGenerate.value;
  if (!generate?.flowKey) return false;
  return generate.slots
    .filter((slot) => slot.kind === "sheet" && !slot.optional)
    .every((slot) => Boolean(slot.fileKey));
});

function markDirty(id: string): void {
  const next = new Set(dirtyIds.value);
  next.add(id);
  dirtyIds.value = next;
}

function clearDirty(id: string): void {
  if (!dirtyIds.value.has(id)) return;
  const next = new Set(dirtyIds.value);
  next.delete(id);
  dirtyIds.value = next;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const next = await getToon(toonId.value);
    toon.value = next;
    dirtyIds.value = new Set();
    seriesGenerate.value = null;
    if (next.seriesKey) {
      try {
        const body = await getSeries(next.seriesKey);
        seriesGenerate.value = body.series.generate || null;
      } catch {
        seriesGenerate.value = null;
      }
    }
    if (!pageId.value && next.pages[0]) {
      await router.replace(`/${next.id}/pages/${next.pages[0].id}`);
    }
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Failed to load");
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(toonId, load);

async function onGenerateSubmit(payload: {
  prompt: string;
  includePrevious: boolean;
  previousFile: File | null;
}): Promise<void> {
  if (!toon.value) return;
  generateBusy.value = true;
  generateError.value = "";
  generateStatus.value = "Queuing…";
  try {
    const queued = await generatePage(toon.value.id, { ...payload, pageId: null });
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      const snap = await getJob(queued.id);
      if (snap.status === "done" && snap.toon) {
        toon.value = snap.toon;
        generateOpen.value = false;
        const last = snap.toon.pages[snap.toon.pages.length - 1];
        if (last) await router.push(`/${snap.toon.id}/pages/${last.id}`);
        return;
      }
      if (snap.status === "error") {
        generateError.value = snap.error || "Generate failed";
        return;
      }
      generateStatus.value = "Generating page…";
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
    }
    generateError.value = "Timed out waiting for ComfyUI";
  } catch (err) {
    generateError.value = err instanceof Error ? err.message : "Generate failed";
  } finally {
    generateBusy.value = false;
  }
}

async function onUpload(file: File): Promise<void> {
  if (!toon.value) return;
  try {
    const size = await readImageSize(file);
    const next = await uploadPage(toon.value.id, file, size);
    toon.value = next;
    dirtyIds.value = new Set();
    const last = next.pages[next.pages.length - 1];
    if (last) await router.push(`/${next.id}/pages/${last.id}`);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Upload failed");
  }
}

async function onRemovePage(id: string): Promise<void> {
  if (!toon.value) return;
  const pages = toon.value.pages;
  const index = pages.findIndex((p) => p.id === id);
  if (index < 0) return;
  const wasActive = activePage.value?.id === id;
  try {
    await deletePage(id);
    const next = pages
      .filter((p) => p.id !== id)
      .map((p) => (p.position > index ? { ...p, position: p.position - 1 } : p));
    toon.value = { ...toon.value, pages: next };
    if (selectedId.value && !next.some((p) => p.bubbles.some((b) => b.id === selectedId.value))) {
      selectedId.value = null;
    }
    if (wasActive) {
      const fallback = next[Math.min(index, next.length - 1)];
      await router.replace(fallback ? `/${toon.value.id}/pages/${fallback.id}` : `/${toon.value.id}/pages`);
    }
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Delete page failed");
  }
}

async function onReplaceThumb(pageId: string, file: File): Promise<void> {
  replacingId.value = pageId;
  try {
    const size = await readImageSize(file);
    const next = await replacePage(pageId, file, size);
    toon.value = toon.value ? mergeReplacedPage(toon.value, next, pageId) : next;
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Replace failed");
  } finally {
    replacingId.value = null;
  }
}

function findBubble(id: string): BubbleRecord | null {
  if (!toon.value) return null;
  for (const page of toon.value.pages) {
    const found = page.bubbles.find((b) => b.id === id);
    if (found) return found;
  }
  return null;
}

function applyLocal(id: string, patch: Partial<BubbleRecord>): void {
  if (!toon.value) return;
  for (const page of toon.value.pages) {
    const i = page.bubbles.findIndex((b) => b.id === id);
    if (i < 0) continue;
    page.bubbles[i] = { ...page.bubbles[i], ...patch };
    return;
  }
}

function onInspectChange(patch: Partial<BubbleRecord>): void {
  if (!selectedId.value) return;
  applyLocal(selectedId.value, patch);
  markDirty(selectedId.value);
}

function onMove(id: string, x: number, y: number): void {
  applyLocal(id, { x, y });
  markDirty(id);
}

function onPersist(id: string, x: number, y: number): void {
  applyLocal(id, { x, y });
  markDirty(id);
}

async function saveDirty(): Promise<void> {
  const ids = [...dirtyIds.value];
  if (!ids.length) return;
  saving.value = true;
  try {
    for (const id of ids) {
      const bubble = findBubble(id);
      if (!bubble) {
        clearDirty(id);
        continue;
      }
      const saved = await patchBubble(id, bubbleWritePayload(bubble));
      applyLocal(id, saved);
      clearDirty(id);
    }
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Save failed");
  } finally {
    saving.value = false;
  }
}

async function onAdd(pos: { x: number; y: number }): Promise<void> {
  const page = activePage.value;
  if (!page) return;
  try {
    const created = await addBubble(page.id, { x: pos.x, y: pos.y, textEn: "" });
    page.bubbles.push(created);
    selectedId.value = created.id;
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not add bubble");
  }
}

async function onRemove(): Promise<void> {
  if (!selectedId.value || !activePage.value) return;
  const id = selectedId.value;
  try {
    await deleteBubble(id);
    activePage.value.bubbles = activePage.value.bubbles.filter((b) => b.id !== id);
    clearDirty(id);
    selectedId.value = null;
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Delete failed");
  }
}
</script>

<template>
  <div class="editor-studio">
    <EditorBar
      :title="toon?.title || 'Pages'"
      :badge="toon ? visibilityLabel(toon.status) : ''"
      :visibility="toon ? visibilityFromStatus(toon.status) : ''"
    >
      <template #actions>
        <RouterLink class="editor-btn editor-btn--ghost" :to="`/${toonId}`">
          <Settings2 :size="16" :stroke-width="1.4" aria-hidden="true" />
          Meta
        </RouterLink>
        <LangSwitcher :languages="switchLangs" v-model="previewLang" />
      </template>
      <template #primary>
        <button
          class="editor-btn"
          type="button"
          name="save-bubbles"
          :disabled="!dirtyCount || saving"
          @click="saveDirty"
        >
          <Save :size="16" :stroke-width="1.4" aria-hidden="true" />
          {{ saving ? "Saving…" : dirtyCount ? `Save (${dirtyCount})` : "Save" }}
        </button>
      </template>
    </EditorBar>
    <p v-if="loading">Loading…</p>
    <template v-else-if="toon">
      <div class="editor-studio-body">
        <PageFilmstrip
          :toon-id="toon.id"
          :pages="toon.pages"
          :active-id="activePage?.id ?? null"
          :can-generate="canGenerate"
          :replacing-id="replacingId"
          @upload="onUpload"
          @generate="generateOpen = true"
          @remove="onRemovePage"
          @replace="onReplaceThumb"
        />
        <PlateCanvas
          v-if="activePage"
          :key="activePage.fileKey"
          :src="activePage.fileUrl"
          :page-num="activePage.position + 1"
          :bubbles="activePage.bubbles"
          :selected-id="selectedId"
          :lang="previewLang"
          :design-width="toon.designWidth"
          :design-height="toon.designHeight"
          @select="selectedId = $event"
          @move="onMove"
          @persist="onPersist"
          @add="onAdd"
        />
        <div v-else class="editor-canvas editor-canvas--empty">
          <p class="editor-muted">Upload a page to start placing bubbles.</p>
          <label class="editor-btn">
            Upload page
            <input
              type="file"
              accept="image/webp,image/jpeg,image/png"
              hidden
              @change="
                ($event.target as HTMLInputElement).files?.[0] &&
                  onUpload(($event.target as HTMLInputElement).files![0])
              "
            />
          </label>
        </div>
        <CaptionInspector
          :bubble="selectedBubble"
          :toon-id="toon.id"
          :asset-page-dir="toon.assetPageDir"
          @change="onInspectChange"
          @preview="previewLang = $event"
          @remove="onRemove"
        />
      </div>
      <GeneratePageDialog
        :open="generateOpen"
        :generate="seriesGenerate"
        :has-previous="toon.pages.length > 0"
        :busy="generateBusy"
        :status="generateStatus"
        :error="generateError"
        @close="!generateBusy && (generateOpen = false)"
        @submit="onGenerateSubmit"
      />
    </template>
  </div>
</template>
