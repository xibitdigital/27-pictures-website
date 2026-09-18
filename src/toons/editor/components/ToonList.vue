<script setup lang="ts">
import { BookPlus, FolderPlus, UserPlus } from "@lucide/vue";
import { computed, inject, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { listSeries, listToons } from "../api";
import { EDITOR_USER_KEY } from "../session";
import { pushToast } from "../toast";
import {
  parsePublishSite,
  PUBLISH_SITE_OPTIONS,
  TOON_VISIBILITY,
  visibilityFromStatus,
  visibilityLabel,
  type PublishSite,
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
import EditorButton from "./ui/EditorButton.vue";
import EditorChipFilter from "./ui/EditorChipFilter.vue";

const RECENT_LIMIT = 8;
const CATALOG_FILTER_KEY = "editor-catalog-filter";

function readCatalogFilter(): PublishSite {
  try {
    return parsePublishSite(localStorage.getItem(CATALOG_FILTER_KEY));
  } catch {
    return "studio";
  }
}

const userRef = inject(EDITOR_USER_KEY);
const isAdmin = computed(() => userRef?.value?.role === "admin");
const toons = ref<ToonListItem[]>([]);
const seriesList = ref<SeriesOption[]>([]);
const recentToons = ref<ToonListItem[]>([]);
const loading = ref(true);
const visibilityFilter = ref<VisibilityFilter>("all");
const catalogFilter = ref<PublishSite>(readCatalogFilter());

watch(catalogFilter, (value) => {
  try {
    localStorage.setItem(CATALOG_FILTER_KEY, value);
  } catch {
    /* private mode */
  }
});

onMounted(async () => {
  try {
    const [books, shelves, recent] = await Promise.all([listToons(), listSeries(), listToons({ limit: RECENT_LIMIT })]);
    toons.value = books;
    seriesList.value = shelves;
    recentToons.value = recent;
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Failed to load");
  } finally {
    loading.value = false;
  }
});

/** "3h ago" / "2d ago" — coarse on purpose, this is a recency cue, not a timestamp. */
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function matchesFilter(toon: ToonListItem): boolean {
  if (visibilityFilter.value === "all") return true;
  return visibilityFromStatus(toon.status) === visibilityFilter.value;
}

function seriesCatalog(series: SeriesOption): PublishSite {
  return parsePublishSite(series.publishSite);
}

function toonCatalog(toon: ToonListItem): PublishSite {
  if (toon.seriesKey) {
    const series = seriesList.value.find((item) => item.key === toon.seriesKey);
    if (series) return seriesCatalog(series);
  }
  return parsePublishSite(toon.publishSite);
}

function matchesCatalog(toon: ToonListItem): boolean {
  return toonCatalog(toon) === catalogFilter.value;
}

const grouped = computed(() => {
  const groups = seriesList.value
    .filter((series) => seriesCatalog(series) === catalogFilter.value)
    .map((series) => ({
      series,
      toons: toons.value
        .filter((toon) => toon.seriesKey === series.key && matchesFilter(toon))
        .sort((a, b) => (a.episodeN ?? 99) - (b.episodeN ?? 99)),
    }));
  if (visibilityFilter.value === "all") return groups;
  return groups.filter((group) => group.toons.length);
});

const ungrouped = computed(() =>
  toons.value.filter((toon) => !toon.seriesKey && matchesFilter(toon) && matchesCatalog(toon))
);
const filteredRecent = computed(() => recentToons.value.filter((toon) => matchesFilter(toon) && matchesCatalog(toon)));

const filteredCount = computed(
  () => grouped.value.reduce((n, group) => n + group.toons.length, 0) + ungrouped.value.length
);

const visibilityChipOptions = computed(() =>
  VISIBILITY_FILTERS.map((opt) => ({
    value: opt.value,
    label: opt.label,
    visibility: opt.value === "all" ? undefined : opt.value,
  }))
);
</script>

<template>
  <section class="editor-list">
    <EditorBar title="FlipFrame Studio" :home="false">
      <template #after-title>
        <div class="editor-list-catalog" role="tablist" aria-label="Catalog">
          <EditorButton
            v-for="opt in PUBLISH_SITE_OPTIONS"
            :key="opt.value"
            variant="ghost"
            size="small"
            :name="`catalog-filter-${opt.value}`"
            role="tab"
            :aria-selected="catalogFilter === opt.value"
            @click="catalogFilter = opt.value"
            >{{ opt.label }}</EditorButton
          >
        </div>
        <EditorChipFilter
          :options="visibilityChipOptions"
          v-model="visibilityFilter"
          role="radiogroup"
          ariaLabel="Visibility"
          name-prefix="visibility-filter-"
        />
        <span data-toon-count>{{ filteredCount }}</span>
      </template>
      <template #actions>
        <EditorButton v-if="isAdmin" variant="ghost" to="/users">
          <UserPlus :size="16" :stroke-width="1.4" aria-hidden="true" />
          Manage users
        </EditorButton>
        <EditorButton variant="ghost" to="/series/new">
          <FolderPlus :size="16" :stroke-width="1.4" aria-hidden="true" />
          New series
        </EditorButton>
      </template>
      <template #primary>
        <EditorButton to="/new">
          <BookPlus :size="16" :stroke-width="1.4" aria-hidden="true" />
          New toon
        </EditorButton>
      </template>
    </EditorBar>
    <div class="editor-list-body">
      <p v-if="loading">Loading…</p>
      <template v-else>
        <section v-if="filteredRecent.length" class="editor-list-section editor-list-section--recent">
          <h2 class="editor-list-heading">Recently changed</h2>
          <ul class="editor-card-list editor-card-list--compact">
            <li v-for="toon in filteredRecent" :key="`recent-${toon.id}`">
              <ToonCard
                compact
                :to="`/${toon.id}/pages`"
                :title="toon.title || toon.slug"
                :meta="toon.episodeN != null ? `Episode ${toon.episodeN}` : toon.subtitle || ''"
                :cue="relativeTime(toon.updatedAt)"
                :cover-url="toon.coverUrl"
                :badge="visibilityLabel(toon.status)"
                :visibility="visibilityFromStatus(toon.status)"
                :share-href="toon.readerUrl || `/toons/${toon.slug}/`"
              />
            </li>
          </ul>
        </section>
        <p v-if="!seriesList.length && !toons.length" class="editor-muted">No series yet.</p>
        <p v-else-if="!grouped.length && !ungrouped.length" class="editor-muted">No toons match this filter.</p>
        <section v-for="group in grouped" :key="group.series.key" class="editor-list-section">
          <h2 class="editor-list-heading">
            <RouterLink :to="`/series/${group.series.key}`">{{ group.series.title }}</RouterLink>
          </h2>
          <ul class="editor-card-list editor-card-list--compact">
            <li v-if="!group.toons.length">
              <ToonCard
                compact
                :to="`/series/${group.series.key}`"
                :title="group.series.title"
                :meta="group.series.tagline || ''"
                cue="No episodes yet"
                :cover-url="group.series.coverUrl"
              />
            </li>
            <li v-for="toon in group.toons" :key="toon.id">
              <ToonCard
                compact
                :to="`/${toon.id}`"
                :title="toon.title || toon.slug"
                :meta="toon.episodeN != null ? `Episode ${toon.episodeN}` : toon.subtitle || ''"
                :cue="toon.pageCount ? `${toon.pageCount} pages` : toon.slug"
                :cover-url="toon.coverUrl"
                :badge="visibilityLabel(toon.status)"
                :visibility="visibilityFromStatus(toon.status)"
                :share-href="toon.readerUrl || `/toons/${toon.slug}/`"
              />
            </li>
          </ul>
        </section>
        <section v-if="ungrouped.length" class="editor-list-section">
          <h2 class="editor-list-heading">Ungrouped</h2>
          <ul class="editor-card-list editor-card-list--compact">
            <li v-for="toon in ungrouped" :key="toon.id">
              <ToonCard
                compact
                :to="`/${toon.id}`"
                :title="toon.title || toon.slug"
                :meta="toon.subtitle || ''"
                :cue="toon.pageCount ? `${toon.pageCount} pages` : toon.slug"
                :cover-url="toon.coverUrl"
                :badge="visibilityLabel(toon.status)"
                :visibility="visibilityFromStatus(toon.status)"
                :share-href="toon.readerUrl || `/toons/${toon.slug}/`"
              />
            </li>
          </ul>
        </section>
      </template>
    </div>
  </section>
</template>
