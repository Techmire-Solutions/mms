import { todayISO } from "@mms/shared";
import { useUiPreference, useUiStateStore } from "@/lib/useUiStateStore";
import type { DashboardNotificationItem } from "@/lib/buildDashboardNotifications";

const READ_STATE_KEY = "notifications_read";
const MAX_READ_KEYS = 100;

type ReadableNotification = Pick<DashboardNotificationItem, "id" | "title">;

/**
 * Derived alerts have stable ids, so the read key also carries the day and title
 * (which embeds the count): a changed or new-day alert shows as unread again.
 */
export function notificationReadKey(item: ReadableNotification): string {
  return `${item.id}|${todayISO()}|${item.title}`;
}

/** Read/unread state synced through the backend UI-state store (per user, cross-device). */
export function useNotificationReadState() {
  const [readKeys, setReadKeys] = useUiPreference<string[]>(READ_STATE_KEY, []);
  const readSet = new Set(readKeys);

  const persist = (items: ReadableNotification[]) => {
    // Merge against the freshest store state: two marks in the same tick
    // (before the subscription re-renders) must not duplicate read keys.
    const latest = useUiStateStore.getState().state[READ_STATE_KEY];
    const base = Array.isArray(latest) ? (latest as string[]) : readKeys;
    const added = items.map(notificationReadKey).filter((key) => !base.includes(key));
    if (added.length === 0) return;
    setReadKeys([...base, ...added].slice(-MAX_READ_KEYS));
  };

  return {
    isRead: (item: ReadableNotification) => readSet.has(notificationReadKey(item)),
    markRead: (item: ReadableNotification) => persist([item]),
    markAllRead: (items: ReadableNotification[]) => persist(items),
  };
}
