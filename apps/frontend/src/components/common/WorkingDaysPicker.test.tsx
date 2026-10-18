import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkingDaysPicker } from "./WorkingDaysPicker";

describe("WorkingDaysPicker", () => {
  it("given selected days, should render a labelled group with seven localized day toggles", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(
      <WorkingDaysPicker
        label="Weekly working days"
        description="Hint"
        value={["Saturday", "sunday"]}
        onChange={vi.fn()}
      />,
    );

    // Assert
    expect(html).toContain("<legend");
    expect(html).toContain("Weekly working days");
    expect(html.match(/name="workingDays"/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
    for (const day of ["Sunday", "Monday", "Saturday"]) expect(html).toContain(day);
  });
});
