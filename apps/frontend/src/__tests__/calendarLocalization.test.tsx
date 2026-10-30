import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "@/components/ui/calendar";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const localeState = vi.hoisted(() => ({ language: "ar", dir: "rtl" as "ltr" | "rtl" }));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => `t:${key}`,
    language: localeState.language,
    dir: localeState.dir,
    isRtl: localeState.dir === "rtl",
    isLoading: false,
  }),
}));

const OCTOBER_2026 = new Date(2026, 9, 1);

function gregorianMonthYear(locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    calendar: "gregory",
  }).format(OCTOBER_2026);
}

function shortWeekday(locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2026, 9, 4));
}

describe("Calendar localization", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localeState.language = "ar";
    localeState.dir = "rtl";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const renderCalendar = async (): Promise<void> => {
    await act(async () => {
      root.render(<Calendar mode="single" defaultMonth={OCTOBER_2026} captionLayout="dropdown" />);
    });
  };

  it("given Arabic, should set dir/lang and render Arabic weekday, day and grid labels when rendered", async () => {
    // Act
    await renderCalendar();

    // Assert
    const rootElement = container.querySelector('[dir="rtl"]');
    expect(rootElement).not.toBeNull();
    expect(rootElement?.getAttribute("lang")).toBe("ar");
    expect(container.querySelector('[aria-label="t:datePicker.selectMonth"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="t:datePicker.selectYear"]')).not.toBeNull();
    expect(container.textContent).toContain(shortWeekday("ar-SA"));
    expect(container.textContent).toContain(new Intl.NumberFormat("ar-SA").format(1));
    const grid = container.querySelector('[role="grid"]');
    expect(grid?.getAttribute("aria-label")).toContain(gregorianMonthYear("ar-SA"));
    expect(container.textContent).not.toContain("October");
  });

  it("given Persian, should keep Gregorian month names rather than the Jalali calendar when rendered", async () => {
    // Arrange
    localeState.language = "fa";
    localeState.dir = "rtl";

    // Act
    await renderCalendar();

    // Assert
    const grid = container.querySelector('[role="grid"]');
    expect(grid?.getAttribute("aria-label")).toContain(gregorianMonthYear("fa-IR"));
    expect(container.textContent).not.toContain("October");
  });

  it("given English, should keep LTR and English month/day labels when rendered", async () => {
    // Arrange
    localeState.language = "en";
    localeState.dir = "ltr";

    // Act
    await renderCalendar();

    // Assert
    const rootElement = container.querySelector('[dir="ltr"]');
    expect(rootElement).not.toBeNull();
    expect(rootElement?.getAttribute("lang")).toBe("en");
    const grid = container.querySelector('[role="grid"]');
    expect(grid?.getAttribute("aria-label")).toContain("October 2026");
    expect(container.textContent).toContain("1");
  });
});
