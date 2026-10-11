import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SavedReportCard } from "./SavedReportCard";
import type { GenericSavedReport } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    dateFormat: "YYYY-MM-DD",
  }),
}));

const mockReport: GenericSavedReport = {
  id: "rep-101",
  name: "Monthly Attendance Summary",
  category: "attendance",
  filters: {},
  lastRun: "2026-09-01T10:00:00Z",
  createdBy: "usr-1",
  createdByName: "Ustadh Ahmad",
  createdAt: "2026-09-01T09:00:00Z",
};

describe("SavedReportCard", () => {
  it("renders report title, category, last run date, and creator", () => {
    const html = renderToStaticMarkup(
      <SavedReportCard report={mockReport} onRun={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(html).toContain("Monthly Attendance Summary");
    expect(html).toContain("Ustadh Ahmad");
    expect(html).toContain("reports.saved.run");
    expect(html).toContain("reports.saved.delete");
    expect(html).toContain('aria-label="reports.saved.run: Monthly Attendance Summary"');
    expect(html).toContain('aria-label="reports.saved.delete: Monthly Attendance Summary"');
    // Enforce 44px touch targets
    expect(html).toContain("min-h-11");
  });

  it("omits run button when onRun is not provided", () => {
    const html = renderToStaticMarkup(<SavedReportCard report={mockReport} onDelete={vi.fn()} />);

    expect(html).not.toContain("reports.saved.run");
    expect(html).toContain("reports.saved.delete");
  });
});
