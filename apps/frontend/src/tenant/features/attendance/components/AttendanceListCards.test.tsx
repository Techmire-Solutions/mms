import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceListCards } from "./AttendanceListCards";
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

describe("AttendanceListCards Component", () => {
  it("renders mobile card layout with student details", () => {
    const html = renderToStaticMarkup(
      <AttendanceListCards
        paginatedRecords={[mockRecord]}
        isColumnVisible={() => true}
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
        t={((k: string) => k) as unknown as never}
      />,
    );

    expect(html).toContain("Bilal Ahmad");
    expect(html).toContain("Class 1A");
    expect(html).toContain("attendance.columns.session");
    expect(html).toContain("Spring 2025");
    expect(html).toContain("On time");
  });

  it("renders empty state when no records", () => {
    const html = renderToStaticMarkup(
      <AttendanceListCards
        paginatedRecords={[]}
        isColumnVisible={() => true}
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
        t={((k: string) => k) as unknown as never}
      />,
    );

    expect(html).toContain("attendance.empty.records");
  });

  it("renders selected state and editing time controls", () => {
    const html = renderToStaticMarkup(
      <AttendanceListCards
        paginatedRecords={[mockRecord]}
        isColumnVisible={(key) => key === "timeIn" || key === "timeOut"}
        editingRecord={mockRecord}
        statuses={mockStatuses}
        updateDraft={vi.fn()}
        classLabel={() => "Class 1A"}
        renderRowActions={() => <button type="button">Edit</button>}
        selectedIds={["rec-1"]}
        canDelete={true}
        allVisibleSelected={true}
        someVisibleSelected={false}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedRecord={vi.fn()}
        t={((k: string) => k) as unknown as never}
      />,
    );

    expect(html).toContain("attendance-mobile-time-in-rec-1");
    expect(html).toContain("attendance-mobile-time-out-rec-1");
  });
});
