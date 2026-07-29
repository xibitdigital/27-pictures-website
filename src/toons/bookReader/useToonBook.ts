/**
 * Vue composable: FlipFrame engine lifecycle (reactive, no DOM mutation).
 */
import { onMounted, onBeforeUnmount, shallowRef } from "vue";
import { createBookEngine, type BookEngine } from "./bookReader";
import type { ToonBookApi, ToonBookOptions } from "./types";

/**
 * Create and start the book engine after mount; destroy on unmount.
 */
export function useToonBook(opts: ToonBookOptions = {}): {
  engine: BookEngine;
  getApi: () => ToonBookApi | undefined;
} {
  const engine = createBookEngine(opts);
  const started = shallowRef(false);

  onMounted(() => {
    void engine.start().then(() => {
      started.value = true;
    });
  });

  onBeforeUnmount(() => {
    engine.destroy();
  });

  return {
    engine,
    getApi: () => (started.value || engine.state.ready ? engine : engine),
  };
}
