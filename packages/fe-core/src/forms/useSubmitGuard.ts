import { useCallback, useRef } from "react";

/**
 * Synchronous in-flight guard for financial form submits.
 *
 * State-based `saving`/`submitting` flags only disable the button after a
 * re-render, so a double-click (or Enter + click) in the same frame can run the
 * save twice. A journal save generates a client id per invocation, so the second
 * call would post a second voucher with a different server reference. The ref is
 * set before the first await and released in `finally`.
 */
export function useSubmitGuard(): <T>(task: () => Promise<T>) => Promise<T | undefined> {
  const inFlight = useRef(false);
  return useCallback(async <T>(task: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    try {
      return await task();
    } finally {
      inFlight.current = false;
    }
  }, []);
}
