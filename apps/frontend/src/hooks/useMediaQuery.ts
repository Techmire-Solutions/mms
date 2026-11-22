import { useCallback, useSyncExternalStore } from "react";

const NOOP_SUBSCRIBE = (): (() => void) => () => {};

/** Subscribe to a CSS media query; updates when the match changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") return NOOP_SUBSCRIBE();
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // The server snapshot reads the same guarded source (false without a
  // window) so SSR renders — including happy-dom's renderToString — see the
  // same value as a client render would.
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
