<script setup lang="ts">
import { computed, inject, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { listSeries, listToons } from "../api";
import { EDITOR_USER_KEY } from "../session";
import { pushToast } from "../toast";
import { visibilityFromStatus, visibilityLabel, type SeriesOption, type ToonListItem } from "../types";
import EditorBar from "./EditorBar.vue";
import ToonCard from "./ToonCard.vue";

const userRef = inject(EDITOR_USER_KEY);
const isAdmin = computed(() => userRef?.value?.role === "admin");
const toons = ref<ToonListItem[]>([]);
const seriesList = ref<SeriesOption[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const [books, shelves] = await Promise.all([listToons(), listSeries()]);
    toons.value = books;
    seriesList.value = shelves;
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Failed to load");
  } finally {
    loading.value = false;
  }
});

const grouped = computed(() =>
  seriesList.value.map((series) => ({
    series,
    toons: toons.value
      .filter((toon) => toon.seriesKey === series.key)
      .sort((a, b) => (a.episodeN ?? 99) - (b.episodeN ?? 99)),
  }))
);

const ungrouped = computed(() => toons.value.filter((toon) => !toon.seriesKey));
</script>

<template>
  <section class="editor-list">
    <EditorBar title="Toon editor" :home="false">
      <template #actions>
        <RouterLink v-if="isAdmin" class="editor-btn editor-btn--ghost" to="/users">Invite user</RouterLink>
        <RouterLink class="editor-btn editor-btn--ghost" to="/series/new">New series</RouterLink>
        <RouterLink class="editor-btn" to="/new">New toon</RouterLink>
      </template>
    </EditorBar>
    <div class="editor-list-body">
      <p v-if="loading">Loading…</p>
      <template v-else>
        <p v-if="!seriesList.length && !toons.length" class="editor-muted">No series yet.</p>
        <section v-for="group in grouped" :key="group.series.key" class="editor-list-section">
          <h2 class="editor-list-heading">
            <RouterLink :to="`/series/${group.series.key}`">{{ group.series.title }}</RouterLink>
          </h2>
          <p v-if="!group.toons.length" class="editor-muted">No episodes yet.</p>
          <ul v-else class="editor-card-list">
            <li v-for="toon in group.toons" :key="toon.id">
              <ToonCard
                :to="`/${toon.id}`"
                :title="toon.title || toon.slug"
                :meta="toon.episodeN != null ? `Episode ${toon.episodeN}` : toon.subtitle || ''"
                :cue="toon.pageCount ? `${toon.pageCount} pages` : toon.slug"
                :cover-url="toon.coverUrl"
                :badge="visibilityLabel(toon.status)"
                :visibility="visibilityFromStatus(toon.status)"
              />
            </li>
          </ul>
        </section>
        <section v-if="ungrouped.length" class="editor-list-section">
          <h2 class="editor-list-heading">Ungrouped</h2>
          <ul class="editor-card-list">
            <li v-for="toon in ungrouped" :key="toon.id">
              <ToonCard
                :to="`/${toon.id}`"
                :title="toon.title || toon.slug"
                :meta="toon.subtitle || ''"
                :cue="toon.pageCount ? `${toon.pageCount} pages` : toon.slug"
                :cover-url="toon.coverUrl"
                :badge="visibilityLabel(toon.status)"
                :visibility="visibilityFromStatus(toon.status)"
              />
            </li>
          </ul>
        </section>
      </template>
    </div>
  </section>
</template>
