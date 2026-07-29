import type { Directive } from "vue";

/** Subtle magnetic hover — binds to the element itself (no getElementById). */
export const vMagnetic: Directive<HTMLElement> = {
  mounted(el) {
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
    };
    const onLeave = () => {
      el.style.transform = "translate(0px, 0px)";
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    (el as HTMLElement & { __magnetic?: { onMove: typeof onMove; onLeave: typeof onLeave } }).__magnetic = {
      onMove,
      onLeave,
    };
  },
  unmounted(el) {
    const h = (el as HTMLElement & { __magnetic?: { onMove: (e: MouseEvent) => void; onLeave: () => void } })
      .__magnetic;
    if (!h) return;
    el.removeEventListener("mousemove", h.onMove);
    el.removeEventListener("mouseleave", h.onLeave);
    delete (el as HTMLElement & { __magnetic?: unknown }).__magnetic;
  },
};
