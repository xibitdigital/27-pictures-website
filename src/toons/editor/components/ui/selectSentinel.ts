/**
 * Reka's Select reserves an empty-string item value as its internal
 * "nothing selected" sentinel, so a real item can't use `value=""` the way
 * a native `<option value="">None</option>` could. EditorSelect and
 * EditorSelectItem both translate at this same boundary so callers keep
 * writing `value=""` for a "None" option exactly like the native select did.
 */
export const NONE_SENTINEL = "__none__";

export function toInternalValue(value: string): string {
  return value === "" ? NONE_SENTINEL : value;
}

export function toExternalValue(value: string | undefined): string {
  if (value === undefined || value === NONE_SENTINEL) return "";
  return value;
}
