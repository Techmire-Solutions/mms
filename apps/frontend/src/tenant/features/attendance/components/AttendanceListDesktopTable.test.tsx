import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceListDesktopTable } from "./AttendanceListDesktopTable";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/data/attendanceData";

const mockRecord: AttendanceRecord = {
  id: "rec-1",
  studentId: "std-1",
  studentName: "Bilal Ahmad",
  rollNo: "GR-001",
  classId: "cls-1",
  sessionName: "Spring 2025",
  date: "2025-01-01",
  status: "present",
  timeIn: "08:00",
  timeOut: "12:00",
  notes: "On time",
  createdAt: "2025-01-01T08:00:00Z",
  updatedAt: "2025-01-01T08:00:00Z",
};

const mockStatuses: AttendanceStatus[] = [
  {
    id: "present",
    label: "Present",
    short: "P",
    color: "#10b981",
    bg: "bg-success",
    text: "text-success",
    border: "border-success",
    dot: "bg-success",
  },
];

describe("AttendanceListDesktopTable Component", () => {
  it("renders desktop table with student records", () => {
    const html = renderToStaticMarkup(
      <AttendanceListDesktopTable
        paginatedRecords={[mockRecord]}
        isColumnVisible={() => true}
        visibleColCount={8}
        editingRecord={null}
        statuses={mockStatuses}
        updateDraft={vi.fn()}
        classLabel={() => "Class 1A"}
        renderRowActions={() => <div>Actions</div>}
        selectedIds={[]}
        canDelete={true}
        allVisibleSelected={false}
        someVisibleSelected={false}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedRecord={vi.fn()}
        t={((k: string) => k) as any}
      />,
    );

    expect(html).toContain("Bilal Ahmad");
    expect(html).toContain("Class 1A");
    expect(html).toContain("attendance.columns.session");
    expect(html).toContain("Spring 2025");
    expect(html).toContain("On time");
  });
});
