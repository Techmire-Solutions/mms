/**
 * Minimizes state payloads at capture time (RFC 8785 Audit Trail).
 * Computes forward and backward diffs so only changed, added, or removed attributes
 * are stored in old_state and new_state, reducing storage bloat and privacy exposure.
 */
export function calculateStateDelta(
  oldState: unknown,
  newState: unknown,
): { oldDelta: unknown; newDelta: unknown } {
  if (oldState === null || oldState === undefined) {
    return { oldDelta: null, newDelta: newState ?? null };
  }
  if (newState === null || newState === undefined) {
    return { oldDelta: oldState, newDelta: null };
  }
  if (
    typeof oldState !== "object" ||
    typeof newState !== "object" ||
    Array.isArray(oldState) ||
    Array.isArray(newState)
  ) {
    return { oldDelta: oldState, newDelta: newState };
  }

  const oldObj = oldState as Record<string, unknown>;
  const newObj = newState as Record<string, unknown>;

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const oldDelta: Record<string, unknown> = {};
  const newDelta: Record<string, unknown> = {};
  let changed = false;

  for (const key of allKeys) {
    const valOld = oldObj[key];
    const valNew = newObj[key];

    // Check JSON serialization equality
    if (JSON.stringify(valOld) !== JSON.stringify(valNew)) {
      changed = true;
      if (key in oldObj) oldDelta[key] = valOld;
      if (key in newObj) newDelta[key] = valNew;
    }
  }

  if (!changed) {
    return { oldDelta: null, newDelta: null };
  }

  return { oldDelta, newDelta };
}
