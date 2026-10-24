import { describe, it, expect, vi, beforeEach } from "vitest";
import { ROUTES } from "@/lib/config/routes";
import { openNotificationTarget } from "./useOpenTenantNotification";

const readDrillDown = (key: string): unknown => JSON.parse(sessionStorage.getItem(key) ?? "null");

describe("openNotificationTarget", () => {
  beforeEach(() => sessionStorage.clear());

  it("given an unpaid-invoices target, should preset the invoice statuses and open Finance when opened", () => {
    // Arrange
    const navigate = vi.fn();

    // Act
    openNotificationTarget({ kind: "invoices", statuses: ["pending", "overdue"] }, navigate);

    // Assert
    expect(navigate).toHaveBeenCalledWith(ROUTES.finance);
    expect(readDrillDown("mms_finance_work_drilldown")).toEqual({
      invoiceStatuses: ["pending", "overdue"],
    });
  });

  it("given a low-attendance target, should preset the day and open Attendance when opened", () => {
    // Arrange
    const navigate = vi.fn();

    // Act
    openNotificationTarget({ kind: "attendanceDay", date: "2026-10-07" }, navigate);

    // Assert
    expect(navigate).toHaveBeenCalledWith(ROUTES.attendance);
    expect(readDrillDown("mms_attendance_work_drilldown")).toEqual({ date: "2026-10-07" });
  });

  it("given an inactive-students target, should preset the status and open Students when opened", () => {
    // Arrange
    const navigate = vi.fn();

    // Act
    openNotificationTarget({ kind: "students", status: "inactive" }, navigate);

    // Assert
    expect(navigate).toHaveBeenCalledWith(ROUTES.students);
    expect(readDrillDown("mms_students_work_drilldown")).toEqual({ status: "inactive" });
  });
});
