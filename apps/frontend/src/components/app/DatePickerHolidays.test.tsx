import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DatePickerCalendarContent } from "./DatePickerCalendarContent";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const t = ((key: string) => key) as unknown as TranslationFunction;

function render(holidays?: readonly string[]) {
  return renderToStaticMarkup(
    <DatePickerCalendarContent
      displayMonth={new Date(2026, 9, 1)}
      setDisplayMonth={() => {}}
      holidays={holidays}
      handleSelect={() => {}}
      handleClear={() => {}}
      handleSelectToday={() => {}}
      isTodayAllowed
      hasValue={false}
      t={t}
    />,
  );
}

describe("DatePicker holiday highlighting", () => {
  it("marks a holiday with the destructive tint and a non-colour dot", () => {
    // Act
    const html = render(["2026-10-05"]);

    // Assert
    expect(html).toContain("text-destructive");
    expect(html).toContain("after:bg-destructive");
  });

  it("centres the dot without a physical left/right offset, so RTL mirrors correctly", () => {
    // Act
    const html = render(["2026-10-05"]);

    // Assert
    expect(html).toContain("after:inset-x-0");
    expect(html).toContain("after:mx-auto");
    expect(html).not.toContain("after:left-");
  });

  it("adds no holiday styling when no holidays are given", () => {
    // Act
    const html = render();

    // Assert
    expect(html).not.toContain("after:bg-destructive");
  });

  it("adds no holiday styling for an empty holiday list", () => {
    // Act
    const html = render([]);

    // Assert
    expect(html).not.toContain("after:bg-destructive");
  });

  it("ignores a malformed date instead of marking the wrong day", () => {
    // Act
    const html = render(["not-a-date"]);

    // Assert
    expect(html).not.toContain("after:bg-destructive");
  });
});
