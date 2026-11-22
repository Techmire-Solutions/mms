/**
 * Storage key for the local background-jobs mirror.
 *
 * Job payloads include export labels and progress state tied to one signed-in
 * account; on a shared browser the store must be scoped to the workspace and
 * the user so one account's tray never renders (or replays) another's jobs,
 * and `clearUserScopedCachesOnLogout` can remove it.
 *
 * Pure module — no imports — so both the storage layer and the auth logout
 * path can depend on it without a cycle (same pattern as
 * `contactsOutboxStorageKeys`).
 */
export function backgroundJobStorageKey(prefix: string, userId?: string): string {
  const scope = userId ? `_u:${userId}` : "";
  return `${prefix}background_jobs_v2${scope}`;
}
