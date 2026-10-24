import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkAttendanceStatsStrip } from "./MarkAttendanceStatsStrip";
import type { AttendanceStatus } from "@/lib/data/attendanceData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

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

describe("MarkAttendanceStatsStrip Component", () => {
  it("renders status count cards", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceStatsStrip statuses={mockStatuses} stats={{ present: 18, absent: 2 }} />,
    );

    expect(html).toContain("18");
    expect(html).toContain("2");
    expect(html).toContain("Present");
    expect(html).toContain("Absent");
  });
});
