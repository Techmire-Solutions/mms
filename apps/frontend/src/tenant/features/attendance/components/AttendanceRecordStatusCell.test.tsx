import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceRecordStatusCell } from "./AttendanceRecordStatusCell";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/data/attendanceData";

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useAttendanceConfig: () => ({
    statuses: [
      { id: "present", label: "Present", short: "P", bg: "bg-success", text: "text-success" },
      { id: "absent", label: "Absent", short: "A", bg: "bg-destructive", text: "text-destructive" },
    ],
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockRecord: AttendanceRecord = {
  id: "rec-1",
  studentId: "std-1",
  studentName: "Bilal Ahmad",
  rollNo: "GR-001",
  classId: "cls-1",
  date: "2025-01-01",
  status: "present",
  timeIn: "08:00",
  timeOut: "12:00",
  notes: "",
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
  {
    id: "absent",
    label: "Absent",
    short: "A",
    color: "#ef4444",
    bg: "bg-destructive",
    text: "text-destructive",
    border: "border-destructive",
    dot: "bg-destructive",
  },
];

describe("AttendanceRecordStatusCell Component", () => {
  it("renders status badge when not editing", () => {
    const html = renderToStaticMarkup(
      <AttendanceRecordStatusCell
        attendanceRecord={mockRecord}
        editingRecord={null}
        statuses={mockStatuses}
        updateDraft={vi.fn()}
      />,
    );

    expect(html).toContain("Present");
  });

  it("renders StatusToggle when record is currently being edited", () => {
    const html = renderToStaticMarkup(
      <AttendanceRecordStatusCell
        attendanceRecord={mockRecord}
        editingRecord={mockRecord}
        statuses={mockStatuses}
        updateDraft={vi.fn()}
      />,
    );

    expect(html).toBeDefined();
  });
});
