import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { ReportFilterDateRangeSection } from "./ReportFilterDateRangeSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/components/DatePicker", () => ({
  DatePicker: ({ id, value, className }: { id: string; value: string; className?: string }) => (
    <input id={id} name={id} value={value} className={className} readOnly />
  ),
}));

const t = ((key: string) => key) as TranslationFunction;

describe("ReportFilterDateRangeSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-22T10:00:00Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  async function renderSection(onFieldChange = vi.fn()) {
    await act(async () => {
      root.render(
        <ReportFilterDateRangeSection
          dateFrom=""
          dateTo=""
          showDateFrom
          showDateTo
          onFieldChange={onFieldChange}
          t={t}
        />,
      );
    });
    return onFieldChange;
  }

  it("given a narrow filter column, should wrap the presets as a group and keep the label on one line", async () => {
    // Arrange
    await renderSection();

    // Act
    const label = Array.from(container.querySelectorAll("span")).find(
      (span) => span.textContent === "reports.comparison.dateRanges",
    );
    const labelRow = label?.parentElement;

    // Assert
    expect(labelRow?.classList.contains("flex-wrap")).toBe(true);
    expect(label?.classList.contains("whitespace-nowrap")).toBe(true);
  });

  it("given From and To pickers, should stack them full width with a shared label width so the inputs line up", async () => {
    // Arrange
    await renderSection();

    // Act
    const fromLabel = container.querySelector('label[for="report-filters-from"]');
    const toLabel = container.querySelector('label[for="report-filters-to"]');
    const bar = fromLabel?.parentElement?.parentElement;

    // Assert
    expect(bar?.classList.contains("grid")).toBe(true);
    expect(bar?.classList.contains("grid-cols-1")).toBe(true);
    expect(bar?.classList.contains("flex")).toBe(false);
    expect(fromLabel?.classList.contains("sm:min-w-14")).toBe(true);
    expect(toLabel?.classList.contains("sm:min-w-14")).toBe(true);
  });

  it("given a preset click, should set both ends of the range", async () => {
    // Arrange
    const onFieldChange = await renderSection();
    const today = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "datePicker.today",
    );

    // Act
    await act(async () => {
      today?.click();
    });

    // Assert
    expect(onFieldChange).toHaveBeenNthCalledWith(1, "dateFrom", "2026-11-22");
    expect(onFieldChange).toHaveBeenNthCalledWith(2, "dateTo", "2026-11-22");
  });

  it("given each remaining preset, should report a from/to pair for every click", async () => {
    // Arrange
    const onFieldChange = await renderSection();
    const labels = ["common.none", "messaging.datePreset7d", "messaging.datePreset30d"];
    const buttons = Array.from(container.querySelectorAll("button")).filter((button) =>
      labels.includes(button.textContent ?? ""),
    );

    // Act
    await act(async () => {
      buttons.forEach((button) => button.click());
    });

    // Assert
    expect(buttons).toHaveLength(3);
    expect(onFieldChange.mock.calls.map(([key]) => key)).toEqual([
      "dateFrom",
      "dateTo",
      "dateFrom",
      "dateTo",
      "dateFrom",
      "dateTo",
    ]);
  });
});
