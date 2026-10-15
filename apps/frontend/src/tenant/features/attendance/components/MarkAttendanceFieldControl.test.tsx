import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkAttendanceFieldControl } from "./MarkAttendanceFieldControl";
import type { AttendanceRow } from "../lib/markAttendanceTypes";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./StatusToggle", () => ({
  StatusToggle: ({ value }: { value: string }) => <div data-testid="status-toggle">{value}</div>,
}));

vi.mock("@/components/app/TimePicker", () => ({
  TimePicker: ({ value }: { value: string }) => (
    <input data-testid="time-picker" defaultValue={value} />
  ),
}));

const mockRow: AttendanceRow = {
  studentId: "std-1",
  name: "Bilal Ahmad",
  rollNo: "GR-001",
  status: "present",
  timeIn: "08:00",
  timeOut: "12:00",
  notes: "Punctual",
};

describe("MarkAttendanceFieldControl Component", () => {
  it("renders status toggle for status field", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceFieldControl
        row={mockRow}
        field={{ id: "status", label: "Status", type: "select" } as unknown as never}
        idPrefix="table"
        onFieldChange={vi.fn()}
      />,
    );

    expect(html).toContain("status-toggle");
    expect(html).toContain("present");
  });

  it("renders TimePicker for timeIn / timeOut field", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceFieldControl
        row={mockRow}
        field={{ id: "timeIn", label: "Time In", type: "time" } as unknown as never}
        idPrefix="table"
        onFieldChange={vi.fn()}
      />,
    );

    expect(html).toContain("time-picker");
  });

  it("renders notes input for notes field", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceFieldControl
        row={mockRow}
        field={{ id: "notes", label: "Notes", type: "text" } as unknown as never}
        idPrefix="table"
        onFieldChange={vi.fn()}
      />,
    );

    expect(html).toContain('value="Punctual"');
  });
});
