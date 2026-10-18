import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyReportsTier } from "./FacultyReportsTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/faculty/hooks/useFaculty", () => ({
  useFacultyMetrics: () => ({
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/tenant/components/moduleReports", () => ({
  KPISummary: ({ category }: { category: string }) => (
    <div data-testid="kpi-summary">KPI: {category}</div>
  ),
  ModuleReports: ({ category }: { category: string }) => (
    <div data-testid="module-reports">Reports: {category}</div>
  ),
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/app/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("FacultyReportsTier Component", () => {
  it("renders KPI summary and module reports for faculty", () => {
    const html = renderToStaticMarkup(<FacultyReportsTier />);

    expect(html).toContain("KPI: faculty");
    expect(html).toContain("Reports: faculty");
  });
});
