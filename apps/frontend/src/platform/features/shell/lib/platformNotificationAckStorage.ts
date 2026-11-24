/**
 * localStorage backing for acknowledged platform notifications.
 *
 * Keys are scoped per platform admin (`_u:<userId>`) so one operator's acks
 * never suppress another operator's unread badges on a shared device. Kept in
 * `platform/lib` (not the hook file) so the logout path can purge the keys
 * without importing the hook and creating a context cycle.
 */
const STORAGE_KEY_PREFIX = "mms_platform_notif_ack";

/** Legacy unscoped key — removed on logout, never read. */
export const LEGACY_PLATFORM_NOTIF_ACK_KEY = STORAGE_KEY_PREFIX;

export function platformNotificationAckStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}_u:${userId}`;
}

export function readPlatformNotificationAcks(userId: string | null): Set<string> {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(platformNotificationAckStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
  } catch {
    // ignore malformed storage
  }
  return new Set();
}

export function writePlatformNotificationAcks(userId: string | null, ids: Set<string>): void {
  if (!userId) return;
  try {
    localStorage.setItem(platformNotificationAckStorageKey(userId), JSON.stringify([...ids]));
  } catch {
    // ignore quota/private mode
  }
}

/** Removes the signed-out admin's ack markers (and any legacy unscoped key). */
export function clearPlatformNotificationAckStorage(userId?: string | null): void {
  try {
    if (userId) localStorage.removeItem(platformNotificationAckStorageKey(userId));
    localStorage.removeItem(LEGACY_PLATFORM_NOTIF_ACK_KEY);
  } catch {
    // ignore private mode
  }
}
