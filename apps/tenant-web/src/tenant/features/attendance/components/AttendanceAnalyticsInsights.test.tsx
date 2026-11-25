import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceAnalyticsInsights } from "./AttendanceAnalyticsInsights";

describe("AttendanceAnalyticsInsights Component", () => {
  it("renders low attendance callout and top performers", () => {
    const html = renderToStaticMarkup(
      <AttendanceAnalyticsInsights
        t={((k: string) => k) as unknown as never}
        lowAttendance={[{ id: "student-1", name: "Zayd", rate: 60 }]}
        lowAttendanceCount={1}
        topStudents={[{ id: "student-2", name: "Ali", rate: 99 }]}
      />,
    );

    expect(html).toContain("Zayd");
    expect(html).toContain("60%");
    expect(html).toContain("attendance.analytics.charts.topPerformersTitle");
    expect(html).toContain("Ali");
    expect(html).toContain("99%");
  });
});
