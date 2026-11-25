import { describe, expect, it } from "vitest";
import {
  buildDashboardNotifications,
  type DashboardNotificationItem,
} from "@/lib/buildDashboardNotifications";

describe("NotificationsPanel item filtering logic", () => {
  const sampleNotifications: DashboardNotificationItem[] = [
    {
      id: "notif-1",
      type: "fee",
      title: "Overdue Invoice",
      desc: "Invoice #101 is overdue",
      time: "1h ago",
      urgent: true,
    },
    {
      id: "notif-2",
      type: "event",
      title: "Staff Meeting",
      desc: "Weekly sync at 3pm",
      time: "2h ago",
      urgent: false,
    },
    {
      id: "notif-3",
      type: "attendance",
      title: "Low Attendance Alert",
      desc: "Attendance rate dropped below threshold",
      time: "3h ago",
      urgent: true,
    },
  ];

  it("correctly calculates urgent items count", () => {
    const urgentCount = sampleNotifications.filter((item) => item.urgent).length;
    expect(urgentCount).toBe(2);
  });

  it("filters out dismissed notification IDs accurately", () => {
    const dismissedIds = new Set<string | number>(["notif-1"]);
    const visible = sampleNotifications.filter((item) => !dismissedIds.has(item.id));

    expect(visible).toHaveLength(2);
    expect(visible.map((n) => n.id)).toEqual(["notif-2", "notif-3"]);
  });

  it("handles empty notifications list gracefully", () => {
    const emptyNotifications: DashboardNotificationItem[] = [];
    const urgentCount = emptyNotifications.filter((item) => item.urgent).length;
    expect(urgentCount).toBe(0);
  });

  it("restores all dismissed notifications when cleared", () => {
    let dismissedIds = new Set<string | number>(["notif-1", "notif-2"]);
    expect(sampleNotifications.filter((item) => !dismissedIds.has(item.id))).toHaveLength(1);

    // Simulate restore all
    dismissedIds = new Set();
    expect(sampleNotifications.filter((item) => !dismissedIds.has(item.id))).toHaveLength(3);
  });
});

describe("buildDashboardNotifications with custom thresholds", () => {
  const mockT = ((key: string, params?: Record<string, string | number>) => {
    if (params?.rate) return `${key}:${params.rate}`;
    return key;
  }) as unknown as Parameters<typeof buildDashboardNotifications>[2];
  const mockFormatCurrency = (amt: unknown) => `$${amt}`;

  it("triggers low attendance notification based on custom threshold", () => {
    const notifs = buildDashboardNotifications(
      "admin",
      {
        outstandingInvoiceCount: 0,
        outstandingBalance: 0,
        attendanceRate: 80,
        inactiveStudents: 0,
      },
      mockT,
      mockFormatCurrency,
      () => true,
      { lowAttendanceThreshold: 85, urgentAttendanceThreshold: 70 },
    );

    const attendanceNotif = notifs.find((n) => n.id === "low-attendance");
    expect(attendanceNotif).toBeDefined();
    expect(attendanceNotif?.urgent).toBe(false);
  });

  it("marks attendance notification as urgent when below custom urgent threshold", () => {
    const notifs = buildDashboardNotifications(
      "admin",
      {
        outstandingInvoiceCount: 0,
        outstandingBalance: 0,
        attendanceRate: 65,
        inactiveStudents: 0,
      },
      mockT,
      mockFormatCurrency,
      () => true,
      { lowAttendanceThreshold: 85, urgentAttendanceThreshold: 70 },
    );

    const attendanceNotif = notifs.find((n) => n.id === "low-attendance");
    expect(attendanceNotif).toBeDefined();
    expect(attendanceNotif?.urgent).toBe(true);
  });
});
