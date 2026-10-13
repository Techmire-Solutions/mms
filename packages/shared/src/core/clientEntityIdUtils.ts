/**
 * Generates a collision-safe client-side entity ID for transient forms, drafts,
 * and optimistic model records before server persistence.
 *
 * Uses `crypto.randomUUID()` when available in standard runtime environments,
 * with a timestamp + pseudo-random suffix fallback.
 */
export function generateClientEntityId(prefix = "", delimiter = ""): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  if (!prefix) {
    return uuid;
  }
  return `${prefix}${delimiter}${uuid}`;
}
