import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatRelativeTime, type TenantNotificationRecord } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
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

/**
 * Per-kind copy, icon type and navigation target.
 *
 * Every stored notification used to render the waitlist sentence regardless of its kind, so a new
 * kind silently displayed the wrong copy (F6). Each kind now owns its sentence, and an unknown kind
 * falls back to the subject/context labels instead of inventing a meaning.
 */
const STORED_NOTIFICATION_COPY: Record<
  TenantNotificationRecord["kind"],
  {
    titleKey: Parameters<Translate>[0];
    descKey: Parameters<Translate>[0];
    type: DashboardNotificationItem["type"];
    target?: DashboardNotificationItem["target"];
  }
> = {
  waitlist_seat_offered: {
    titleKey: "notifications.waitlistSeatOfferedTitle",
    descKey: "notifications.waitlistSeatOfferedDesc",
    type: "admission",
    target: { kind: "admissions" },
  },
  attendance_leave_decided: {
    titleKey: "notifications.attendanceLeaveDecidedTitle",
    descKey: "notifications.attendanceLeaveDecidedDesc",
    type: "attendance",
  },
  attendance_chronic_absence: {
    titleKey: "notifications.attendanceChronicAbsenceTitle",
    descKey: "notifications.attendanceChronicAbsenceDesc",
    type: "attendance",
    target: { kind: "students", status: "active" },
  },
  finance_invoices_overdue: {
    titleKey: "notifications.financeInvoicesOverdueTitle",
    descKey: "notifications.financeInvoicesOverdueDesc",
    type: "fee",
    target: { kind: "invoices", statuses: ["overdue"] },
  },
  accounting_automation_failed: {
    titleKey: "notifications.accountingAutomationFailedTitle",
    descKey: "notifications.accountingAutomationFailedDesc",
    type: "fee",
  },
  task_assigned: {
    titleKey: "notifications.taskAssignedTitle",
    descKey: "notifications.taskAssignedDesc",
    type: "tasks",
    target: { kind: "tasks" },
  },
  task_status_changed: {
    titleKey: "notifications.taskStatusChangedTitle",
    descKey: "notifications.taskStatusChangedDesc",
    type: "tasks",
    target: { kind: "tasks" },
  },
};

export function toStoredNotificationItem(
  record: TenantNotificationRecord,
  t: Translate,
  language: string,
): StoredNotificationItem {
  const copy = STORED_NOTIFICATION_COPY[record.kind];
  if (!copy) {
    return {
      id: `stored:${record.id}`,
      storedId: record.id,
      type: "student",
      title: record.subjectLabel,
      desc: record.contextLabel,
      time: formatRelativeTime(record.createdAt, language),
      read: record.read,
    };
  }
  return {
    id: `stored:${record.id}`,
    storedId: record.id,
    type: copy.type,
    title: t(copy.titleKey),
    desc: t(copy.descKey, { subject: record.subjectLabel, context: record.contextLabel }),
    time: formatRelativeTime(record.createdAt, language),
    target: copy.target,
    read: record.read,
  };
}

/** Server-stored notifications addressed to the caller's permissions, with server read receipts. */
export function useStoredNotifications() {
  const { t, language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const pendingReadRef = useRef<string | null>(null);
  const pendingReadAllRef = useRef(false);
  const { data } = useQuery({ ...storedNotificationsQueryOptions(), enabled: isAuthenticated });
  const markOne = useMutation({
    mutationFn: markStoredNotificationRead,
    onSettled: () => {
      pendingReadRef.current = null;
      invalidateStoredNotificationsQueries(queryClient);
    },
  });
  const markAll = useMutation({
    mutationFn: markAllStoredNotificationsRead,
    onSettled: () => {
      pendingReadAllRef.current = false;
      invalidateStoredNotificationsQueries(queryClient);
    },
  });

  return {
    items: (data?.notifications ?? []).map((record) =>
      toStoredNotificationItem(record, t, language),
    ),
    // Read receipts are idempotent: an already-read item — or one whose POST is
    // still in flight — is never re-POSTed, so double-clicks stay no-ops.
    markRead: (storedId: string) => {
      const record = data?.notifications.find((n) => n.id === storedId);
      if (!record || record.read || pendingReadRef.current !== null) return;
      pendingReadRef.current = storedId;
      markOne.mutate(storedId);
    },
    markAllRead: () => {
      if ((data?.unreadCount ?? 0) > 0 && !pendingReadAllRef.current) {
        pendingReadAllRef.current = true;
        markAll.mutate();
      }
    },
  };
}
