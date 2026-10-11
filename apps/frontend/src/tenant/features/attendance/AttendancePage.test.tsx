import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Attendance from "./AttendancePage";

vi.mock("@/tenant/features/attendance/hooks/useAttendancePageController", () => ({
  useAttendancePageController: () => ({
    t: (key: string) => key,
    can: () => true,
    role: "admin",
    filters: { date: "2025-01-01", session: "all", classId: "all" },
    setFilters: vi.fn(),
    showDeleted: false,
    setShowDeleted: vi.fn(),
    setActiveTab: vi.fn(),
    setActiveOpsTab: vi.fn(),
    setActiveAnalyticsTab: vi.fn(),
    attendanceCollectionQuery: { isError: false, refetch: vi.fn() },
    activeAttendanceRecords: [],
    attendanceRecords: [],
    shownCount: 10,
    setShownCount: vi.fn(),
    columnLayout: {
      isColumnVisible: () => true,
      getColumnWidth: () => 100,
      setColumnWidth: vi.fn(),
      columnRegistry: {},
      updateUserColumnLayout: vi.fn(),
      customizerLabels: {},
    },
    messagingTarget: null,
    closeComposer: vi.fn(),
    handleMessageAttendance: vi.fn(),
    persistRecords: vi.fn(),
    handleUpdateRecord: vi.fn(),
    handleDeleteRecord: vi.fn(),
    handleRestoreRecord: vi.fn(),
    handleBulkDeleteRecords: vi.fn(),
    handleBulkRestoreRecords: vi.fn(),
    canWriteAttendance: true,
    canDeleteAttendance: true,
    visibleTopTabs: [
      { id: "work", label: "Attendance" },
      { id: "reports", label: "Reports" },
      { id: "setup", label: "Setup" },
    ],
    visibleOperationsTabs: [{ id: "mark", label: "Mark" }],
    visibleAnalyticsTabs: [{ id: "charts", label: "Charts" }],
    effectiveTab: "work",
    effectiveOpsTab: "mark",
    effectiveAnalyticsTab: "charts",
  }),
}));

vi.mock("@/components/ui/ModulePageShell", () => ({
  ModulePageShell: ({
    children,
    headerTitle,
  }: {
    children: React.ReactNode;
    headerTitle: string;
  }) => (
    <div data-testid="page-shell">
      <h1>{headerTitle}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/ResponsiveAccordionTabs", () => ({
  ResponsiveAccordionTabs: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs">{children}</div>
  ),
}));

vi.mock("./components/AttendanceCommandMetrics", () => ({
  AttendanceCommandMetrics: () => <div data-testid="metrics">Metrics</div>,
}));

vi.mock("./components/AttendanceWorkTier", () => ({
  AttendanceWorkTier: () => <div data-testid="work-tier">Work Tier</div>,
}));

describe("AttendancePage", () => {
  it("renders page title and work tier properly", () => {
    const html = renderToStaticMarkup(<Attendance />);
    expect(html).toContain("nav.attendance");
    expect(html).toContain("Work Tier");
  });
});
