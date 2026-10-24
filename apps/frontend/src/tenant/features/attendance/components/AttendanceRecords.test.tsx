import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceRecords } from "./AttendanceRecords";

const attendanceMocks = vi.hoisted(() => ({
  useAttendancePaginated: vi.fn(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true }),
  useModulePermissions: () => ({ canWrite: true, canDelete: true }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useAttendanceConfig: () => ({
    statuses: [{ id: "present", label: "Present" }],
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [],
}));

vi.mock("@/tenant/features/attendance/hooks/useAttendance", () => ({
  useAttendancePaginated: attendanceMocks.useAttendancePaginated,
}));

attendanceMocks.useAttendancePaginated.mockReturnValue({
  data: {
    records: [
      {
        id: "rec-1",
        studentId: "std-1",
        studentName: "Bilal Ahmad",
        sessionId: "ses-1",
        classId: "cls-1",
        date: "2025-01-01",
        status: "present",
        timeIn: "08:00",
        timeOut: "12:00",
        notes: "",
        createdAt: "2025-01-01T08:00:00Z",
        updatedAt: "2025-01-01T08:00:00Z",
      },
    ],
    total: 1,
    page: 1,
    limit: 25,
    hasMore: false,
  },
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
});

vi.mock("./AttendanceListFilters", () => ({
  AttendanceListFilters: () => <div data-testid="filters">Filters</div>,
}));

vi.mock("./AttendanceListDesktopTable", () => ({
  AttendanceListDesktopTable: () => <div data-testid="table">Desktop Table</div>,
}));

vi.mock("./AttendanceRecordsConfirmDialogs", () => ({
  AttendanceRecordsConfirmDialogs: () => <div data-testid="confirm-dialogs">Confirm Dialogs</div>,
}));

describe("AttendanceRecords Component", () => {
  it("renders filters, records desktop table, and pagination", () => {
    const html = renderToStaticMarkup(
      <AttendanceRecords
        filters={{ sessionId: "ses-1", classId: "cls-1", facultyId: "fac-1", date: "2025-01-01" }}
        onUpdateRecord={vi.fn()}
        onDeleteRecord={vi.fn()}
        onRestoreRecord={vi.fn()}
        onBulkDeleteRecords={vi.fn()}
        onBulkRestoreRecords={vi.fn()}
      />,
    );

    expect(html).toContain("Filters");
    expect(html).toContain("Desktop Table");
    expect(html).toContain("Confirm Dialogs");
    expect(attendanceMocks.useAttendancePaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "ses-1",
        classId: "cls-1",
        facultyId: "fac-1",
      }),
    );
  });
});
