import type { ContactsCrossModuleQueryKeys } from "./host.js";

/**
 * App-provided query keys for the features contacts must invalidate. Bound once
 * by the app composition root; plain (non-React) functions read it directly.
 */
let keys: ContactsCrossModuleQueryKeys | null = null;

export function configureContactsCrossModuleQueryKeys(next: ContactsCrossModuleQueryKeys): void {
  keys = next;
}

const EMPTY: ContactsCrossModuleQueryKeys = {
  messagingContactsResolve: [],
  messagingRecipients: [],
  studentsMetrics: [],
  students: [],
};

/**
 * Returns the configured keys, or empty keys when the app has not configured
 * them yet (tests / early boot). Invalidating an empty key is a safe no-op.
 */
export function getContactsCrossModuleQueryKeys(): ContactsCrossModuleQueryKeys {
  return keys ?? EMPTY;
}
