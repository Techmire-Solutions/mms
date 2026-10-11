import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkAttendanceGrid } from "./MarkAttendanceGrid";
import type { AttendanceRow } from "./markAttendanceTypes";
import type { AttendanceStatus } from "@/lib/data/attendanceData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./MarkAttendanceFieldControl", () => ({
  MarkAttendanceFieldControl: ({ row, field }: { row: AttendanceRow; field: any }) => (
    <div data-testid={`control-${field.id}`}>{row.name}</div>
  ),
}));

const mockRow: AttendanceRow = {
  studentId: "std-1",
  name: "Bilal Ahmad",
  rollNo: "GR-001",
  status: "present",
  timeIn: "08:00",
  timeOut: "12:00",
  notes: "",
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

describe("MarkAttendanceGrid Component", () => {
  it("renders desktop and mobile attendance grids", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceGrid
        rows={[mockRow]}
        orderedFields={[{ id: "status", label: "Status", type: "select" } as any]}
        statuses={mockStatuses}
        isFieldEnabled={() => true}
        onFieldChange={vi.fn()}
      />,
    );

    expect(html).toContain("Bilal Ahmad");
    expect(html).toContain("GR-001");
    expect(html).toContain("control-status");
    expect(html).toContain("Status");
  });

  it("renders empty state when rows is empty", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceGrid
        rows={[]}
        orderedFields={[{ id: "status", label: "Status", type: "select" } as any]}
        statuses={mockStatuses}
        isFieldEnabled={() => true}
        onFieldChange={vi.fn()}
      />,
    );

    expect(html).toContain("attendance.mark.noStudents");
  });

  it("renders cards mode explicitly without table elements", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceGrid
        rows={[mockRow]}
        orderedFields={[{ id: "status", label: "Status", type: "select" } as any]}
        statuses={mockStatuses}
        isFieldEnabled={() => true}
        onFieldChange={vi.fn()}
        viewMode="cards"
      />,
    );

    expect(html).toContain("Bilal Ahmad");
    expect(html).not.toContain("<table");
  });

  it("renders table mode explicitly without card grid", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceGrid
        rows={[mockRow]}
        orderedFields={[{ id: "status", label: "Status", type: "select" } as any]}
        statuses={mockStatuses}
        isFieldEnabled={() => true}
        onFieldChange={vi.fn()}
        viewMode="table"
      />,
    );

    expect(html).toContain("Bilal Ahmad");
    expect(html).toContain("<table");
  });
});
