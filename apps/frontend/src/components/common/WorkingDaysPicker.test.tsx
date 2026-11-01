import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkingDaysPicker } from "./WorkingDaysPicker";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

  it("adds a day exactly once when its checkbox is clicked", async () => {
    // Regression guard for the 2026-11-01 report: the card's manual toggle and
    // Radix's hidden input produced two updates and left form checkboxes stuck.
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<WorkingDaysPicker label="Working days" value={[]} onChange={onChange} />);
    });
    const sunday = container.querySelector<HTMLButtonElement>('button[role="checkbox"]');
    await act(async () => {
      sunday?.click();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(["sunday"]);
    await act(async () => root.unmount());
    container.remove();
  });
});
