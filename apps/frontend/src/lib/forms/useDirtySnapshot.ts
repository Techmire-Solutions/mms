import { useCallback, useRef } from "react";

/**
 * Identity-aware dirty tracking for hand-rolled forms. The baseline resets when `resetKey`
 * changes (open/record identity) — never because a parent refetch produced a new object.
 */
export function useDirtySnapshot<T>(
  value: T,
  resetKey: string,
): {
  isDirty: boolean;
  resetBaseline: () => void;
} {
  const keyRef = useRef(resetKey);
  const baselineRef = useRef(JSON.stringify(value));
  if (keyRef.current !== resetKey) {
    keyRef.current = resetKey;
    baselineRef.current = JSON.stringify(value);
  }
  const resetBaseline = useCallback(() => {
    baselineRef.current = JSON.stringify(value);
  }, [value]);
  return { isDirty: JSON.stringify(value) !== baselineRef.current, resetBaseline };
}
