import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyReportsTier } from "./FacultyReportsTier";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../hooks/useFaculty", () => ({
  useFacultyMetrics: () => ({
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../host/moduleReports", () => ({
  KPISummary: ({ category }: { category: string }) => (
    <div data-testid="kpi-summary">KPI: {category}</div>
  ),
  ModuleReports: ({ category }: { category: string }) => (
    <div data-testid="module-reports">Reports: {category}</div>
  ),
}));

vi.mock("@mms/ui/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@mms/fe-core/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("FacultyReportsTier Component", () => {
  it("renders KPI summary and module reports for faculty", () => {
    const html = renderToStaticMarkup(<FacultyReportsTier />);

    expect(html).toContain("KPI: faculty");
    expect(html).toContain("Reports: faculty");
  });
});
