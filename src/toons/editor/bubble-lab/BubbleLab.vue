<script setup lang="ts">
import { computed, ref } from "vue";
import WordCaption from "../../bookReader/captions/WordCaption.vue";
import { galleryRows, reshapeRows } from "./gallery";

const line = ref("Hello.");
const rows = computed(() => galleryRows(line.value));

const reshapeLine = ref(
  "This is a very long text, this is the story of my life in a bubble...This is a very long text, this is the story of my life in a bubble..."
);
const reshapeCells = computed(() => reshapeRows(reshapeLine.value));
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
    <section class="bubble-lab-row" data-variant="reshape-fit">
      <h2>Reshape fit</h2>
      <p>
        Stand-ins for dragging a balloon's control points in the plate studio — checks that
        <code>shapeTextFit</code> grows the lettering and re-wraps to match the outline instead of leaving dead padding
        (or overflowing a pinched one).
      </p>
      <label>
        Line
        <input name="lab-reshape-line" type="text" autocomplete="off" spellcheck="false" v-model="reshapeLine" />
      </label>
      <div class="bubble-lab-grid bubble-lab-grid--reshape">
        <article
          v-for="cell in reshapeCells"
          :key="cell.key"
          class="bubble-lab-cell bubble-lab-cell--reshape"
          :data-reshape="cell.key"
        >
          <p class="bubble-lab-label">{{ cell.label }}</p>
          <div class="bubble-lab-stage bubble-lab-stage--reshape">
            <WordCaption :caption="cell.caption" />
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
