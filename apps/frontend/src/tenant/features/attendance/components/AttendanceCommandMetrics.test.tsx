import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceCommandMetrics } from "./AttendanceCommandMetrics";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/attendance/hooks/useAttendance", () => ({
  useAttendanceMetrics: () => ({
    data: {
      total: 50,
      selectedDatePresent: 40,
      selectedDateAbsent: 5,
      selectedDateLate: 3,
      selectedDateExcused: 2,
      periodTotal: 250,
    },
  }),
}));

describe("AttendanceCommandMetrics Component", () => {
  it("renders metric cards with server data", () => {
    const html = renderToStaticMarkup(
      <AttendanceCommandMetrics total={50} shown={45} selectedDate="2025-01-01" />,
    );

    expect(html).toContain("attendance.metrics.total");
    expect(html).toContain("50");
    expect(html).toContain("45");
    expect(html).toContain("attendance.metrics.present");
    expect(html).toContain("40");
  });
});
