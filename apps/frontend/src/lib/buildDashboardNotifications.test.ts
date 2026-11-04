import { describe, expect, it } from "vitest";
import {
  buildDashboardNotifications,
  MAX_DASHBOARD_NOTIFICATIONS,
  type DashboardNotificationMetrics,
} from "./buildDashboardNotifications";

const baseMetrics: DashboardNotificationMetrics = {
  outstandingInvoiceCount: 0,
  outstandingBalance: 0,
  attendanceRate: 90,
  inactiveStudents: 0,
};

describe("buildDashboardNotifications", () => {
  const mockT = (key: string, params?: Record<string, string | number>) => {
    if (params?.count) return `${key}:${params.count}`;
    if (params?.amount) return `${key}:${params.amount}`;
    if (params?.rate) return `${key}:${params.rate}`;
    return key;
  };

  it("builds unpaid invoices notification for admin with outstanding balance", () => {
    const notifications = buildDashboardNotifications(
      "admin",
      {
        outstandingInvoiceCount: 5,
        outstandingBalance: 1500,
        attendanceRate: 90,
        inactiveStudents: 0,
      },
      mockT,
      (val) => `$${val}`,
      () => true,
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe("unpaid-invoices");
    expect(notifications[0].urgent).toBe(true);
  });

  it("builds low attendance notification when rate drops below threshold", () => {
    const notifications = buildDashboardNotifications(
      "admin",
      {
        outstandingInvoiceCount: 0,
        outstandingBalance: 0,
        attendanceRate: 55,
        inactiveStudents: 2,
      },
      mockT,
      (val) => `$${val}`,
      () => true,
    );

    expect(notifications).toHaveLength(2);
    expect(notifications.some((n) => n.id === "low-attendance" && n.urgent)).toBe(true);
    expect(notifications.some((n) => n.id === "inactive-students")).toBe(true);
  });

  it("builds fees clear notification for accountant when no unpaid invoices exist", () => {
    const notifications = buildDashboardNotifications(
      "accountant",
      {
        outstandingInvoiceCount: 0,
        outstandingBalance: 0,
        attendanceRate: 95,
        inactiveStudents: 0,
      },
      mockT,
      (val) => `$${val}`,
      () => true,
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe("fees-clear");
    expect(notifications[0].urgent).toBe(false);
  });

  it("hides finance alerts when the caller cannot write invoices", () => {
    const notifications = buildDashboardNotifications(
      "admin",
      { ...baseMetrics, outstandingInvoiceCount: 3, outstandingBalance: 900 },
      mockT,
      (val) => `$${val}`,
      (permission) => !permission.startsWith("finance."),
    );

    expect(notifications.find((n) => n.id === "unpaid-invoices")).toBeUndefined();
  });

  it("uses the configured attendance thresholds instead of the defaults", () => {
    const low = buildDashboardNotifications(
      "admin",
      { ...baseMetrics, attendanceRate: 65 },
      mockT,
      (val) => `$${val}`,
      () => true,
      { lowAttendanceThreshold: 70, urgentAttendanceThreshold: 50 },
    ).find((n) => n.id === "low-attendance");
    expect(low?.urgent).toBe(false);

    const urgent = buildDashboardNotifications(
      "admin",
      { ...baseMetrics, attendanceRate: 45 },
      mockT,
      (val) => `$${val}`,
      () => true,
      { lowAttendanceThreshold: 70, urgentAttendanceThreshold: 50 },
    ).find((n) => n.id === "low-attendance");
    expect(urgent?.urgent).toBe(true);
  });

  it("treats an inverted threshold pair as authoritative (every alert escalates)", () => {
    const items = buildDashboardNotifications(
      "admin",
      { ...baseMetrics, attendanceRate: 70 },
      mockT,
      (val) => `$${val}`,
      () => true,
      { lowAttendanceThreshold: 80, urgentAttendanceThreshold: 90 },
    );

    expect(items.find((n) => n.id === "low-attendance")?.urgent).toBe(true);
  });

  it("caps the notification list at the documented maximum", () => {
    const items = buildDashboardNotifications(
      "accountant",
      { ...baseMetrics, inactiveStudents: 5 },
      mockT,
      (val) => `$${val}`,
      () => true,
    );
    expect(items.length).toBeLessThanOrEqual(MAX_DASHBOARD_NOTIFICATIONS);
  });
});
