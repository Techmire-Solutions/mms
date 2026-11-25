import { useCallback, useMemo, useState } from "react";

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
  const [snapshot, setSnapshot] = useState(() => ({
    key: resetKey,
    baseline: JSON.stringify(resetBaselineValue ?? value),
  }));

  // Re-baseline when the record identity changes. Adjusted during render (React's
  // documented "adjust state when props change" pattern, same as `useIdentityReset`)
  // so the committed render never reports the previous record's draft as dirty.
  if (snapshot.key !== resetKey) {
    setSnapshot({
      key: resetKey,
      baseline: JSON.stringify(resetBaselineValue ?? value),
    });
  }

  const serialized = useMemo(() => JSON.stringify(value), [value]);

  const resetBaseline = useCallback(() => {
    setSnapshot((prev) => ({ key: prev.key, baseline: JSON.stringify(value) }));
  }, [value]);

  return { isDirty: serialized !== snapshot.baseline, resetBaseline };
}
