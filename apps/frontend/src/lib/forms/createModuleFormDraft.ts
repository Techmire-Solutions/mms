/**
 * Shared form-draft helpers over a record's volatile keys. Module adapters supply
 * the volatile-key set (hydrated/archive chrome not edited on the form) and their
 * per-module default seed; both get a stable get-initial-draft + JSON snapshot.
 */
export function createModuleFormDraft<TRecord extends object>(options: {
  volatileKeys: readonly string[];
  getDefaults: (record?: Partial<TRecord> | null, ...args: unknown[]) => Partial<TRecord>;
}) {
  const { volatileKeys, getDefaults } = options;
  const volatile = new Set(volatileKeys);

  function getInitialDraft(record?: Partial<TRecord> | null, ...args: unknown[]): Partial<TRecord> {
    const draft: Partial<TRecord> = { ...getDefaults(record, ...args) };

    if (!record) return draft;

    for (const [key, value] of Object.entries(record)) {
      if (volatile.has(key)) continue;
      if (key in draft) continue;
      (draft as Record<string, unknown>)[key] = value;
    }
    return draft;
  }

  function draftSnapshot(draft: Partial<TRecord>): string {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(draft)) {
      if (volatile.has(key)) continue;
      payload[key] = value ?? "";
    }
    return JSON.stringify(payload);
  }

  return { getInitialDraft, draftSnapshot };
}
