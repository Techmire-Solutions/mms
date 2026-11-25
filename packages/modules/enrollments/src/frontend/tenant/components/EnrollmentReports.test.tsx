import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentReports } from "./EnrollmentReports";
import { EMPTY_ENROLLMENTS_REPORT_AGGREGATES } from "@mms/contracts";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../host/useCurrency", () => ({
  useFinanceCurrency: () => ({
    formatCurrency: (val: number) => `$${val}`,
  }),
}));

vi.mock("../../tenant/host/BrandingPaletteContext.js", () => ({
  useBrandPalette: () => ({
    primary: "#000",
    secondary: "#111",
    charts: ["#222", "#333", "#444", "#555"],
  }),
}));

vi.mock("@mms/ui/app/SafeResponsiveContainer", () => {
  const MockContainer = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    SafeResponsiveContainer: MockContainer,
    default: MockContainer,
  };
});

import { EnrollmentReportsCharts } from "./EnrollmentReportsCharts";

vi.mock("@mms/fe-core/components/ModuleCommandMetricsGrid", () => ({
  ModuleCommandMetricsGrid: ({ items }: { items: { label: string }[] }) => (
    <div data-testid="metrics-grid">{items.map((i) => i.label).join(", ")}</div>
  ),
}));

vi.mock("../../tenant/host/PinnedWidgets.js", () => ({
  default: () => <div data-testid="pinned-widgets">Pinned Widgets</div>,
}));

describe("EnrollmentReports Component", () => {
  it("renders reports cards and metrics grid", () => {
    const html = renderToStaticMarkup(
      <EnrollmentReports aggregates={EMPTY_ENROLLMENTS_REPORT_AGGREGATES} />,
    );

    expect(html).toContain("enrollments.reports.noData");
    expect(html).toContain("enrollments.reports.revenueBySession");
  });

  it("renders status and session charts", () => {
    const html = renderToStaticMarkup(
      <EnrollmentReportsCharts aggregates={EMPTY_ENROLLMENTS_REPORT_AGGREGATES} />,
    );

    expect(html).toContain("enrollments.reports.byStatus");
    expect(html).toContain("enrollments.reports.bySession");
  });
});
