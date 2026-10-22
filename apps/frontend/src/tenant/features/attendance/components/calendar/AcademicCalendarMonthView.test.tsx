import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { hijriDayOfMonth, hijriMonthSpanLabel } from "@mms/shared";
import { AcademicCalendarMonthView } from "./AcademicCalendarMonthView";

const WORKING_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function render(month = "2026-10-01") {
  return renderToStaticMarkup(
    <AcademicCalendarMonthView
      month={month}
      onMonthChange={() => {}}
      events={[]}
      workingDays={WORKING_DAYS}
    />,
  );
}

describe("AcademicCalendarMonthView — Hijri display", () => {
  it("shows the Hijri month span beneath the Gregorian heading", () => {
    // Arrange
    const expected = hijriMonthSpanLabel("2026-10-01", "2026-10-31", "en");

    // Act
    const html = render();

    // Assert
    expect(expected).not.toBe("");
    expect(html).toContain(expected);
  });

  it("shows the Hijri day number alongside each Gregorian day", () => {
    // Arrange
    const firstHijriDay = hijriDayOfMonth("2026-10-01");

    // Act
    const html = render();

    // Assert
    expect(firstHijriDay).not.toBeNull();
    expect(html).toContain(`>${String(firstHijriDay)}</span>`);
  });

  it("hides the Hijri day number from assistive tech, keeping the Gregorian date as the label", () => {
    // Act
    const html = render();

    // Assert
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('aria-label="2026-10-01"');
  });

  it("still renders the grid when the month changes", () => {
    // Act
    const html = render("2026-11-01");

    // Assert
    expect(html).toContain(hijriMonthSpanLabel("2026-11-01", "2026-11-30", "en"));
  });
});
