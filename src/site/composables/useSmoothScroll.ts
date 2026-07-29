/** Lenis smooth scroll on desktop (same behavior as legacy script.js). */
export function useSmoothScroll(): void {
  if (typeof window === "undefined") return;
  if (window.innerWidth <= 768) return;
  if (typeof window.Lenis !== "function") return;

  const lenis = new window.Lenis();
  function raf(time: number): void {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}
