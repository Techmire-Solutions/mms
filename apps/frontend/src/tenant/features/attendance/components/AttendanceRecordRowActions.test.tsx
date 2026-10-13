import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceRecordRowActions } from "./AttendanceRecordRowActions";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/app/ModuleRowActionsMenu", () => ({
  MODULE_ROW_ACTIONS_TRIGGER_CLASS: "module-row-actions-trigger",
  ModuleRowActionsMenu: ({
    extras,
    triggerLabel,
  }: {
    extras?: React.ReactNode;
    triggerLabel?: string;
  }) => (
    <div data-testid="row-actions">
      <span>{triggerLabel}</span>
      {extras}
    </div>
  ),
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

describe("AttendanceRecordRowActions Component", () => {
  it("renders row action menu with messaging options", () => {
    const html = renderToStaticMarkup(
      <AttendanceRecordRowActions
        attendanceRecord={mockRecord}
        editingRecord={null}
        canWriteAttendance={true}
        canDeleteAttendance={true}
        showDeleted={false}
        onMessage={vi.fn()}
        onRestoreRecord={vi.fn()}
        setEditingRecord={vi.fn()}
        setPendingDeleteId={vi.fn()}
        saveEditingRecord={vi.fn()}
        t={((k: string) => k) as any}
      />,
    );

    expect(html).toContain("attendance.table.actions");
    expect(html).toContain("attendance.message.whatsapp");
    expect(html).toContain("attendance.message.sms");
  });

  it("renders save and cancel buttons when record is being edited", () => {
    const html = renderToStaticMarkup(
      <AttendanceRecordRowActions
        attendanceRecord={mockRecord}
        editingRecord={mockRecord}
        canWriteAttendance={true}
        canDeleteAttendance={true}
        showDeleted={false}
        onMessage={vi.fn()}
        onRestoreRecord={vi.fn()}
        setEditingRecord={vi.fn()}
        setPendingDeleteId={vi.fn()}
        saveEditingRecord={vi.fn()}
        t={((k: string) => k) as any}
      />,
    );

    expect(html).toContain("common.save");
    expect(html).toContain("common.cancel");
  });
});
