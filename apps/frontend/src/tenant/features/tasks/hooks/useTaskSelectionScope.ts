import { useEffect, useRef } from "react";

/**
 * Clears a directory selection when the visible window changes. Runs after
 * render, so the new (filtered) rows are already committed when the selection
 * drops; the first render never clears (the ref is seeded with the initial key).
 */
export function useTaskSelectionScope(scopeKey: string, clearSelection: () => void): void {
  const previousKey = useRef(scopeKey);

  useEffect(() => {
    if (previousKey.current === scopeKey) return;
    previousKey.current = scopeKey;
    clearSelection();
  }, [scopeKey, clearSelection]);
}
