/**
 * Shortest CSS-pixel side the plate studio still fits. iPad Mini is 744×1133;
 * phones fail even in landscape (~390–430 on the short side). Same number as the
 * editor form stack breakpoint in editor.css.
 */
export const EDITOR_MIN_VIEWPORT = 700;

export function editorViewportFits(
  width = typeof window === "undefined" ? EDITOR_MIN_VIEWPORT : window.innerWidth,
  height = typeof window === "undefined" ? EDITOR_MIN_VIEWPORT : window.innerHeight
): boolean {
  return width >= EDITOR_MIN_VIEWPORT && height >= EDITOR_MIN_VIEWPORT;
}
