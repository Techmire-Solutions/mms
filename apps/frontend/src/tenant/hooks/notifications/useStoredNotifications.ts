import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatRelativeTime, type TenantNotificationRecord } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import type { DashboardNotificationItem } from "@/lib/buildDashboardNotifications";
import {
  invalidateStoredNotificationsQueries,
  markAllStoredNotificationsRead,
  markStoredNotificationRead,
  storedNotificationsQueryOptions,
} from "@/lib/query/notificationQueries";

export interface StoredNotificationItem extends DashboardNotificationItem {
  read: boolean;
  /** Server id; present only on stored (non-derived) notifications. */
  storedId: string;
}

type Translate = ReturnType<typeof useTranslation>["t"];

export function toStoredNotificationItem(
  record: TenantNotificationRecord,
  t: Translate,
  language: string,
): StoredNotificationItem {
  return {
    id: `stored:${record.id}`,
    storedId: record.id,
    type: "admission",
    title: t("notifications.waitlistSeatOfferedTitle"),
    desc: t("notifications.waitlistSeatOfferedDesc", {
      applicant: record.subjectLabel,
      class: record.contextLabel,
    }),
    time: formatRelativeTime(record.createdAt, language),
    target: { kind: "admissions" },
    read: record.read,
  };
}

/** Server-stored notifications addressed to the caller's permissions, with server read receipts. */
export function useStoredNotifications() {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useQuery(storedNotificationsQueryOptions());
  const onSettled = () => invalidateStoredNotificationsQueries(queryClient);
  const markOne = useMutation({ mutationFn: markStoredNotificationRead, onSettled });
  const markAll = useMutation({ mutationFn: markAllStoredNotificationsRead, onSettled });

  return {
    items: (data?.notifications ?? []).map((record) => toStoredNotificationItem(record, t, language)),
    markRead: (storedId: string) => markOne.mutate(storedId),
    markAllRead: () => {
      if ((data?.unreadCount ?? 0) > 0) markAll.mutate();
    },
  };
}
