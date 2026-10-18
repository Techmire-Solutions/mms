import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkAttendanceHolidayBanner } from "./MarkAttendanceHolidayBanner";

const holiday = { kind: "holiday" as const, startOn: "2026-03-03", endOn: "2026-03-03", scope: "workspace" as const, sessionId: null, classId: null, sectionId: null, title: "Eid" };

describe("MarkAttendanceHolidayBanner", () => {
  it("given a teaching day, should render nothing", () => {
    // Act
    const html = renderToStaticMarkup(<MarkAttendanceHolidayBanner status={{ instructional: true, allowExtraClass: false, isLoading: false }} />);

    // Assert
    expect(html).toBe("");
  });

  it("given a holiday without the extra-class policy, should explain that marking is blocked", () => {
    // Act
    const html = renderToStaticMarkup(<MarkAttendanceHolidayBanner status={{ instructional: false, event: holiday, allowExtraClass: false, isLoading: false }} />);

    // Assert
    expect(html).toContain("attendance.calendar.markingBlocked");
    expect(html).toContain('role="status"');
  });

  it("given the extra-class policy, should explain that marking is audited instead", () => {
    // Act
    const html = renderToStaticMarkup(<MarkAttendanceHolidayBanner status={{ instructional: false, allowExtraClass: true, isLoading: false }} />);

    // Assert
    expect(html).toContain("attendance.calendar.extraClassAllowed");
    expect(html).not.toContain("attendance.calendar.markingBlocked");
  });
});
