<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { listToons } from "../api";
import { visibilityLabel, type ToonListItem } from "../types";
import EditorBar from "./EditorBar.vue";
import ToonCard from "./ToonCard.vue";

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
    <EditorBar title="Toon editor" :home="false">
      <template #actions>
        <RouterLink class="editor-btn" to="/new">New toon</RouterLink>
      </template>
    </EditorBar>
    <div class="editor-list-body">
      <p v-if="loading">Loading…</p>
      <p v-else-if="error" class="editor-error" role="alert">{{ error }}</p>
      <p v-else-if="!toons.length" class="editor-muted">No drafts yet.</p>
      <ul v-else class="editor-card-list">
        <li v-for="toon in toons" :key="toon.id">
          <ToonCard
            :to="`/${toon.id}`"
            :title="toon.title || toon.slug"
            :meta="visibilityLabel(toon.status)"
            :cue="toon.pageCount ? `${toon.pageCount} pages` : toon.slug"
            :cover-url="toon.coverUrl"
          />
        </li>
      </ul>
    </div>
  </section>
</template>
