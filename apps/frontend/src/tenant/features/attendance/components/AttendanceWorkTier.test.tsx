import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserCheck } from "lucide-react";
import { AttendanceWorkTier } from "./AttendanceWorkTier";

vi.mock("@/tenant/features/attendance/components/AttendanceFilters", () => ({
  AttendanceFilters: () => <div data-testid="filters">Attendance Filters</div>,
}));

vi.mock("@/tenant/features/attendance/components/MarkAttendance", () => ({
  MarkAttendance: () => <div data-testid="mark-attendance">Mark Attendance Component</div>,
}));

vi.mock("@/tenant/features/attendance/components/AttendanceRecords", () => ({
  AttendanceRecords: () => <div data-testid="attendance-records">Attendance Records Component</div>,
}));

vi.mock("@/tenant/features/attendance/components/AuditLog", () => ({
  AuditLog: () => <div data-testid="audit-log">Audit Log Component</div>,
}));

vi.mock("@/components/app/SubTabBar", () => ({
  SubTabBar: ({ tabs }: { tabs: { label: string }[] }) => (
    <div data-testid="sub-tab-bar">{tabs.map((t) => t.label).join(", ")}</div>
  ),
}));

describe("AttendanceWorkTier Component", () => {
  it("renders filters and active operations tab", () => {
    const html = renderToStaticMarkup(
      <AttendanceWorkTier
        showRoleBanner={false}
        role="admin"
        roleLabel="Admin"
        teacherRoleText={null}
        accountantRoleText={null}
        filters={{ date: "2025-01-01", session: "all", classId: "all" } as unknown as never}
        onFiltersChange={vi.fn()}
        activeOpsTab="mark"
        operationsTabs={[
          { id: "mark", label: "Mark", icon: UserCheck },
          { id: "records", label: "Records", icon: UserCheck },
        ]}
        canDeleteAttendance={true}
        showDeleted={false}
        onShowDeletedToggle={vi.fn()}
        showActiveLabel="Active"
        showDeletedLabel="Deleted"
        onOpsTabChange={vi.fn()}
        activeRecords={[]}
        onPersistRecords={vi.fn()}
        onUpdateRecord={vi.fn()}
        onDeleteRecord={vi.fn()}
        onRestoreRecord={vi.fn()}
        onBulkDeleteRecords={vi.fn()}
        onBulkRestoreRecords={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(html).toContain("Attendance Filters");
    expect(html).toContain("Mark Attendance Component");
  });
});
