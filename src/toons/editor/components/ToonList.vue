<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { listToons } from "../api";
import type { ToonListItem } from "../types";
import EditorSession from "./EditorSession.vue";

const toons = ref<ToonListItem[]>([]);
const error = ref("");
const loading = ref(true);

onMounted(async () => {
  try {
    toons.value = await listToons();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="editor-list">
    <header class="editor-list-head">
      <h1>Toon editor</h1>
      <span class="editor-form-actions">
        <EditorSession />
        <RouterLink class="editor-btn" to="/new">New toon</RouterLink>
      </span>
    </header>
    <p v-if="loading">Loading…</p>
    <p v-else-if="error" class="editor-error" role="alert">{{ error }}</p>
    <p v-else-if="!toons.length" class="editor-muted">No drafts yet.</p>
    <ul v-else class="editor-card-list">
      <li v-for="toon in toons" :key="toon.id">
        <RouterLink class="editor-card" :to="`/${toon.id}`">
          <img v-if="toon.coverUrl" :src="toon.coverUrl" :alt="toon.title" />
          <div v-else class="editor-card-placeholder" aria-hidden="true" />
          <span>
            <strong>{{ toon.title || toon.slug }}</strong>
            <small>{{ toon.slug }}{{ toon.pageCount ? ` · ${toon.pageCount} pages` : "" }}</small>
          </span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
