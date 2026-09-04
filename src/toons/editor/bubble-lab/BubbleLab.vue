<script setup lang="ts">
import { computed, ref } from "vue";
import WordCaption from "../../bookReader/captions/WordCaption.vue";
import { galleryRows } from "./gallery";

const line = ref("Hello.");
const rows = computed(() => galleryRows(line.value));
</script>

<template>
  <main class="bubble-lab">
    <header class="bubble-lab-head">
      <h1>Bubble lab</h1>
      <p>Every variant × tail, through the same caption pipeline as the reader. Nothing is saved.</p>
      <label>
        Line
        <input name="lab-line" type="text" autocomplete="off" spellcheck="false" v-model="line" />
      </label>
    </header>
    <section v-for="row in rows" :key="row.variant" class="bubble-lab-row" :data-variant="row.variant">
      <h2>{{ row.variant }}</h2>
      <div class="bubble-lab-grid">
        <article v-for="cell in row.cells" :key="cell.tail" class="bubble-lab-cell" :data-tail="cell.tail">
          <p class="bubble-lab-label">{{ cell.tail }}</p>
          <div class="bubble-lab-stage">
            <WordCaption :caption="cell.caption" />
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
