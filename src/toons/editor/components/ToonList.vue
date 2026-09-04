<script setup lang="ts">
import { BookPlus, FolderPlus, UserPlus } from "@lucide/vue";
import { computed, inject, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { listSeries, listToons } from "../api";
import { EDITOR_USER_KEY } from "../session";
import { pushToast } from "../toast";
import {
  TOON_VISIBILITY,
  visibilityFromStatus,
  visibilityLabel,
  type SeriesOption,
  type ToonListItem,
  type ToonVisibility,
} from "../types";

type VisibilityFilter = "all" | ToonVisibility;

const VISIBILITY_FILTERS: { value: VisibilityFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...TOON_VISIBILITY,
];
import EditorBar from "./EditorBar.vue";
import ToonCard from "./ToonCard.vue";

const userRef = inject(EDITOR_USER_KEY);
const isAdmin = computed(() => userRef?.value?.role === "admin");
const toons = ref<ToonListItem[]>([]);
const seriesList = ref<SeriesOption[]>([]);
const loading = ref(true);
const visibilityFilter = ref<VisibilityFilter>("all");

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

function matchesFilter(toon: ToonListItem): boolean {
  if (visibilityFilter.value === "all") return true;
  return visibilityFromStatus(toon.status) === visibilityFilter.value;
}

const grouped = computed(() => {
  const groups = seriesList.value.map((series) => ({
    series,
    toons: toons.value
      .filter((toon) => toon.seriesKey === series.key && matchesFilter(toon))
      .sort((a, b) => (a.episodeN ?? 99) - (b.episodeN ?? 99)),
  }));
  if (visibilityFilter.value === "all") return groups;
  return groups.filter((group) => group.toons.length);
});

const ungrouped = computed(() => toons.value.filter((toon) => !toon.seriesKey && matchesFilter(toon)));

const filteredCount = computed(
  () => grouped.value.reduce((n, group) => n + group.toons.length, 0) + ungrouped.value.length
);
</script>

<template>
  <section class="editor-list">
    <EditorBar title="Toon editor" :home="false">
      <template #after-title>
        <div class="editor-visibility-filter" role="radiogroup" aria-label="Visibility">
          <button
            v-for="opt in VISIBILITY_FILTERS"
            :key="opt.value"
            type="button"
            :name="`visibility-filter-${opt.value}`"
            :aria-pressed="visibilityFilter === opt.value"
            :data-visibility="opt.value === 'all' ? undefined : opt.value"
            @click="visibilityFilter = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <span data-toon-count>{{ filteredCount }}</span>
      </template>
      <template #actions>
        <RouterLink v-if="isAdmin" class="editor-btn editor-btn--ghost" to="/users">
          <UserPlus :size="16" :stroke-width="1.4" aria-hidden="true" />
          Invite user
        </RouterLink>
        <RouterLink class="editor-btn editor-btn--ghost" to="/series/new">
          <FolderPlus :size="16" :stroke-width="1.4" aria-hidden="true" />
          New series
        </RouterLink>
      </template>
      <template #primary>
        <RouterLink class="editor-btn" to="/new">
          <BookPlus :size="16" :stroke-width="1.4" aria-hidden="true" />
          New toon
        </RouterLink>
      </template>
    </EditorBar>
    <div class="editor-list-body">
      <p v-if="loading">Loading…</p>
      <template v-else>
        <p v-if="!seriesList.length && !toons.length" class="editor-muted">No series yet.</p>
        <p v-else-if="!grouped.length && !ungrouped.length" class="editor-muted">No toons match this filter.</p>
        <section v-for="group in grouped" :key="group.series.key" class="editor-list-section">
          <h2 class="editor-list-heading">
            <RouterLink :to="`/series/${group.series.key}`">{{ group.series.title }}</RouterLink>
          </h2>
          <ul class="editor-card-list">
            <li v-if="!group.toons.length">
              <ToonCard
                :to="`/series/${group.series.key}`"
                :title="group.series.title"
                :meta="group.series.tagline || ''"
                cue="No episodes yet"
                :cover-url="group.series.coverUrl"
              />
            </li>
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
