import { describe, expect, it } from "vitest";
import { buildDashboardNotifications } from "./buildDashboardNotifications";

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
});
