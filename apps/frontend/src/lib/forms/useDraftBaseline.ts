import { useCallback, useState } from "react";

export interface DraftBaseline<T> {
  /** Whether the draft differs from the current baseline (volatile keys already stripped by `snapshot`). */
  isDirty: boolean;
  /** Re-baselines to `next` (or the current draft) — call after a save or a programmatic autofill. */
  resetBaseline: (next?: T) => void;
}

/**
 * Shared dirty-tracking primitive for module forms.
 *
 * Delegates to the module's `snapshot` function (e.g. the `draftSnapshot` returned
 * by `createModuleFormDraft`, or `studentDraftSnapshot`) so hand-rolled forms and
 * RHF forms (`form.reset(values, { keepDirty: true })`) compare against the same
 * volatile-key-stripped baseline instead of each re-implementing it.
 */
export function useDraftBaseline<T>(
  draft: T,
  snapshot: (value: T) => string,
  initialBaseline?: T,
): DraftBaseline<T> {
  const [baseline, setBaseline] = useState(() => snapshot(initialBaseline ?? draft));
  const isDirty = snapshot(draft) !== baseline;

  const resetBaseline = useCallback(
    (next?: T) => {
      setBaseline(snapshot(next ?? draft));
    },
    [snapshot, draft],
  );

  return { isDirty, resetBaseline };
}
