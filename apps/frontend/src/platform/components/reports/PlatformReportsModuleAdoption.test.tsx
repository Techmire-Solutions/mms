import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformReportsModuleAdoption } from "./PlatformReportsModuleAdoption";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/components/reports/ReportChartCard", () => ({
  ReportChartCard: ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="report-chart-card">
      <h3>{title}</h3>
      {subtitle ? <p>{subtitle}</p> : null}
      <div>{children}</div>
    </div>
  ),
}));

describe("PlatformReportsModuleAdoption", () => {
  it("renders module category groups and module cards", () => {
    const html = renderToStaticMarkup(<PlatformReportsModuleAdoption />);

    expect(html).toContain("platform.reports.moduleAdoption");
    expect(html).toContain("platform.reports.moduleAdoptionSub");
    expect(html).toContain("core");
    expect(html).toContain("academic");
    expect(html).toContain("finance");
    expect(html).toContain("Students");
    expect(html).toContain("Accounting");
  });
});
