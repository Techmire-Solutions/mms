/**
 * Generic localStorage "recent items" store: JSON array persistence with
 * validation, identity dedupe, prepend, and a hard cap. Shared SSOT for the
 * platform recent-workspaces list and the tenant command-palette recents.
 */
export interface RecentStore<T> {
  load: () => T[];
  /** Persists `item` at the front (deduped by `identity`) and returns the new list. */
  push: (item: T) => T[];
}

export function createRecentStore<T>(
  storageKey: string,
  cap: number,
  validate: (value: unknown) => value is T,
  identity: (item: T) => string,
): RecentStore<T> {
  const load = (): T[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(validate).slice(0, cap);
    } catch {
      return [];
    }
  };

  const push = (item: T): T[] => {
    const current = load().filter((existing) => identity(existing) !== identity(item));
    const updated = [item, ...current].slice(0, cap);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Ignore quota / private-mode write failures.
    }
    return updated;
  };

  return { load, push };
}
