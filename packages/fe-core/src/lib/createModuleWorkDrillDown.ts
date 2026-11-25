/**
 * Generic report-segment → Work-directory drill-down bridge.
 *
 * Applies a filter by persisting it to sessionStorage and dispatching a
 * CustomEvent; the Work-tier directory filters consume (and clear) it on mount.
 * Used by Contacts and Students to avoid duplicated event/storage plumbing.
 */
export function createModuleWorkDrillDown<F extends object>({
  event,
  storageKey,
}: {
  event: string;
  storageKey: string;
}): {
  apply: (filter: F) => void;
  consume: () => F | null;
} {
  function apply(filter: F): void {
    sessionStorage.setItem(storageKey, JSON.stringify(filter));
    window.dispatchEvent(new CustomEvent(event, { detail: filter }));
  }

  function consume(): F | null {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    sessionStorage.removeItem(storageKey);
    try {
      return JSON.parse(raw) as F;
    } catch {
      return null;
    }
  }

  return { apply, consume };
}
