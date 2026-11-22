import { useEffect, useRef } from "react";

/**
 * Applies a {@link createModuleWorkDrillDown} filter on mount (pending in sessionStorage)
 * and whenever it is dispatched while the page is already open.
 *
 * The listener stays an imperative event subscription rather than a
 * `useSyncExternalStore`: the pending filter is consumed (and cleared) exactly
 * once — there is no store value to snapshot, so an external-store subscription
 * would add cross-tab `storage` plumbing without a reader.
 */
export function useWorkDrillDownListener<F extends object>(
  event: string,
  consume: () => F | null,
  onApply: (filter: F) => void,
): void {
  const onApplyRef = useRef(onApply);
  // Sync the latest callback in an effect — never during render
  // (React Compiler / `react-hooks/refs`).
  useEffect(() => {
    onApplyRef.current = onApply;
  }, [onApply]);

  useEffect(() => {
    const pending = consume();
    if (pending) onApplyRef.current(pending);

    const handler = (e: Event) => {
      consume();
      const detail = (e as CustomEvent<F>).detail;
      if (detail) onApplyRef.current(detail);
    };
    window.addEventListener(event, handler);
    return () => window.removeEventListener(event, handler);
  }, [event, consume]);
}
