import { useCallback, useRef } from "react";

/**
 * Identity-aware dirty tracking for hand-rolled forms. The baseline resets when `resetKey`
 * changes (open/record identity) — never because a parent refetch produced a new object.
 */
export function useDirtySnapshot<T>(
  value: T,
  resetKey: string,
  /**
   * The value the form's reset will produce for this key. Pass it when the reset is
   * scheduled during render (`useIdentityReset`): on the key-change render `value` is
   * still the previous draft, so without this the baseline is captured from the old
   * record and every edit-open looks dirty.
   */
  resetBaselineValue?: T,
): {
  isDirty: boolean;
  resetBaseline: () => void;
} {
  const keyRef = useRef(resetKey);
  const baselineRef = useRef(JSON.stringify(resetBaselineValue ?? value));
  if (keyRef.current !== resetKey) {
    keyRef.current = resetKey;
    baselineRef.current = JSON.stringify(resetBaselineValue ?? value);
  }
  const resetBaseline = useCallback(() => {
    baselineRef.current = JSON.stringify(value);
  }, [value]);
  return { isDirty: JSON.stringify(value) !== baselineRef.current, resetBaseline };
}
