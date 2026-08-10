/**
 * Pure queue transitions for auto-read when the set of on-screen pages changes.
 */

export function parsePageKey(key: string): string[] {
  return key ? key.split("|").filter(Boolean) : [];
}

export function pageKey(ids: string[]): string {
  return ids.join("|");
}

export function isPureSuperset(nextIds: string[], prevIds: string[]): boolean {
  if (!prevIds.length || nextIds.length <= prevIds.length) return false;
  return prevIds.every((id) => nextIds.includes(id));
}

export function isPureSubset(nextIds: string[], prevIds: string[]): boolean {
  if (!nextIds.length || nextIds.length >= prevIds.length) return false;
  return nextIds.every((id) => prevIds.includes(id));
}

export type VisibleDiff<T extends { id: string }> =
  | { kind: "noop" }
  | { kind: "subset"; key: string; wantedIds: string[] }
  | { kind: "expand"; key: string; allIds: string[]; append: T[] }
  | { kind: "replace"; key: string; allIds: string[]; toRead: T[] };

/**
 * Decide how the play queue should react to a new ordered on-screen page list.
 */
export function diffVisiblePages<T extends { id: string }>(
  currentKey: string,
  ordered: T[],
  coveredIds: Set<string>,
  opts: { running: boolean; doneKey: string }
): VisibleDiff<T> {
  const ids = ordered.map((l) => l.id);
  const key = pageKey(ids);
  if (key === currentKey && (opts.running || opts.doneKey === key)) {
    return { kind: "noop" };
  }

  const prevIds = parsePageKey(currentKey);
  const fresh = ordered.filter((l) => !coveredIds.has(l.id));

  // Pages leaving only (8|9 → 8 mid-flip): prune, do not restart remaining.
  if (prevIds.length && isPureSubset(ids, prevIds)) {
    return { kind: "subset", key, wantedIds: ids };
  }

  // Pure expansion by exactly one page (10 → 10|11): append only.
  if (prevIds.length && isPureSuperset(ids, prevIds) && ids.length === prevIds.length + 1 && fresh.length === 1) {
    return { kind: "expand", key, allIds: ids, append: fresh };
  }

  // Real navigation (or first paint): hard-cut to newcomers (or full ordered).
  const newcomers = prevIds.length ? ordered.filter((l) => !prevIds.includes(l.id)) : ordered;
  const toRead = newcomers.length ? newcomers : ordered;
  return { kind: "replace", key, allIds: ids, toRead };
}
