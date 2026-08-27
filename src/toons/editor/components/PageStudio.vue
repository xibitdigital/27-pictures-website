<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { addBubble, deleteBubble, getToon, patchBubble, readImageSize, uploadPage } from "../api";
import { debounce } from "../debounce";
import type { LangCode } from "../../bookReader/types";
import type { BubbleRecord, ToonRecord } from "../types";
import LangSwitcher from "../../bookReader/LangSwitcher.vue";
import { CAPTION_LANGS } from "../mapConfig";
import CaptionInspector from "./CaptionInspector.vue";
import EditorSession from "./EditorSession.vue";
import PageFilmstrip from "./PageFilmstrip.vue";
import PlateCanvas from "./PlateCanvas.vue";

const switchLangs = CAPTION_LANGS.map((l) => ({ code: l.code, label: l.code.toUpperCase() }));

const route = useRoute();
const router = useRouter();

const toon = ref<ToonRecord | null>(null);
const selectedId = ref<string | null>(null);
const previewLang = ref<LangCode>("en");
const error = ref("");
const loading = ref(true);

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

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const next = await getToon(toonId.value);
    toon.value = next;
    if (!pageId.value && next.pages[0]) {
      await router.replace(`/${next.id}/pages/${next.pages[0].id}`);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(toonId, load);

async function onUpload(file: File): Promise<void> {
  if (!toon.value) return;
  error.value = "";
  try {
    const size = await readImageSize(file);
    const next = await uploadPage(toon.value.id, file, size);
    toon.value = next;
    const last = next.pages[next.pages.length - 1];
    if (last) await router.push(`/${next.id}/pages/${last.id}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Upload failed";
  }
}

function applyLocal(id: string, patch: Partial<BubbleRecord>): void {
  const page = activePage.value;
  if (!page) return;
  const i = page.bubbles.findIndex((b) => b.id === id);
  if (i < 0) return;
  page.bubbles[i] = { ...page.bubbles[i], ...patch };
}

const persistText = debounce((id: string, patch: Pick<BubbleRecord, "textEn" | "textJson">) => {
  void patchBubble(id, patch).catch((err: unknown) => {
    error.value = err instanceof Error ? err.message : "Save failed";
  });
}, 300);

const persistExtra = debounce((id: string, extraJson: string | null) => {
  void patchBubble(id, { extraJson }).catch((err: unknown) => {
    error.value = err instanceof Error ? err.message : "Save failed";
  });
}, 300);

function onInspectChange(patch: Partial<BubbleRecord>): void {
  if (!selectedId.value) return;
  applyLocal(selectedId.value, patch);
  if (patch.textEn != null || patch.textJson != null) {
    persistText(selectedId.value, {
      textEn: patch.textEn ?? selectedBubble.value?.textEn ?? "",
      textJson: patch.textJson ?? selectedBubble.value?.textJson ?? null,
    });
  } else if (patch.extraJson !== undefined) {
    persistExtra(selectedId.value, patch.extraJson ?? null);
  } else {
    void patchBubble(selectedId.value, patch).catch((err: unknown) => {
      error.value = err instanceof Error ? err.message : "Save failed";
    });
  }
}

function onMove(id: string, x: number, y: number): void {
  applyLocal(id, { x, y });
}

function onPersist(id: string, x: number, y: number): void {
  applyLocal(id, { x, y });
  void patchBubble(id, { x, y }).catch((err: unknown) => {
    error.value = err instanceof Error ? err.message : "Save failed";
  });
}

async function onAdd(pos: { x: number; y: number }): Promise<void> {
  const page = activePage.value;
  if (!page) return;
  try {
    const created = await addBubble(page.id, { x: pos.x, y: pos.y, textEn: "" });
    page.bubbles.push(created);
    selectedId.value = created.id;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Could not add bubble";
  }
}

async function onRemove(): Promise<void> {
  if (!selectedId.value || !activePage.value) return;
  const id = selectedId.value;
  try {
    await deleteBubble(id);
    activePage.value.bubbles = activePage.value.bubbles.filter((b) => b.id !== id);
    selectedId.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Delete failed";
  }
}
</script>

<template>
  <div class="editor-studio">
    <header class="editor-studio-head">
      <RouterLink class="editor-btn editor-btn--ghost" :to="`/${toonId}`">Meta</RouterLink>
      <h1>{{ toon?.title || "Pages" }}</h1>
      <span class="editor-form-actions">
        <LangSwitcher :languages="switchLangs" v-model="previewLang" />
        <EditorSession />
        <RouterLink class="editor-btn editor-btn--ghost" to="/">All toons</RouterLink>
      </span>
    </header>
    <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
    <p v-if="loading">Loading…</p>
    <template v-else-if="toon">
      <div class="editor-studio-body">
        <PageFilmstrip :toon-id="toon.id" :pages="toon.pages" :active-id="activePage?.id ?? null" @upload="onUpload" />
        <PlateCanvas
          v-if="activePage"
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
          @change="onInspectChange"
          @preview="previewLang = $event"
          @remove="onRemove"
        />
      </div>
    </template>
  </div>
</template>
