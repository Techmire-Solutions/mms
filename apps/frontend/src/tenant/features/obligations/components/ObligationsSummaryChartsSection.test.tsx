import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";

/**
 * Charts used to vanish (`return null`) when a filter matched nothing, while the rep-dues section
 * one block below explained the same condition with an EmptyState — an unexplained blank band
 * (frontend write-path audit F3).
 */

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/app/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

vi.mock("@/components/reports/ReportChartCard", () => ({
  ReportChartCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    BarChart: Passthrough,
    Bar: Passthrough,
    CartesianGrid: Passthrough,
    XAxis: Passthrough,
    YAxis: Passthrough,
    Tooltip: Passthrough,
    Legend: Passthrough,
    PieChart: Passthrough,
    Pie: Passthrough,
    Cell: Passthrough,
    LineChart: Passthrough,
    Line: Passthrough,
  };
});

import { ObligationsSummaryChartsSection } from "./ObligationsSummaryChartsSection";

const formatCurrency = (value: number | string | null | undefined) => String(value ?? "");

function render(props: Record<string, unknown>): HTMLElement {
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(
      <ObligationsSummaryChartsSection
        filteredCount={0}
        typeBreakdown={[]}
        monthlyTrend={[]}
        colors={["#000"]}
        primary="#000"
        formatCurrency={formatCurrency}
        {...props}
      />,
    );
  });
  return div;
}

describe("ObligationsSummaryChartsSection", () => {
  it("explains an empty result instead of rendering nothing", () => {
    const container = render({ filteredCount: 0 });

    expect(container.querySelector('[data-testid="empty-state"]')?.textContent).toBe(
      "obligations.summary.emptyFiltered",
    );
  });

  it("renders the charts when rows match", () => {
    const container = render({
      filteredCount: 2,
      typeBreakdown: [{ label: "Khums", value: 10, count: 1 }],
      monthlyTrend: [{ label: "2026-10", value: 10 }],
    });

    expect(container.querySelector('[data-testid="empty-state"]')).toBeNull();
  });
});
