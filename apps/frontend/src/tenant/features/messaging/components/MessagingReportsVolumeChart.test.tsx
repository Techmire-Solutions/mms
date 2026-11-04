import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagingReportsVolumeChart } from "./MessagingReportsVolumeChart";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

vi.mock("@/tenant/components/moduleReports", () => ({
  ReportChartCard: ({ accessibleSummary }: { accessibleSummary?: React.ReactNode }) => (
    <div data-testid="chart-card">{accessibleSummary}</div>
  ),
}));

vi.mock("recharts", () => ({
  PieChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Legend: () => null,
  Tooltip: () => null,
}));

describe("MessagingReportsVolumeChart", () => {
  it("exposes a localized channel summary for screen readers", () => {
    const html = renderToStaticMarkup(
      <MessagingReportsVolumeChart
        chartData={[
          { name: "SMS", value: 12, channel: "sms" },
          { name: "WhatsApp", value: 5, channel: "whatsapp" },
          { name: "Email", value: 3, channel: "email" },
        ]}
      />,
    );

    expect(html).toContain("messaging.volumeBreakdownSummary");
    expect(html).toContain("&quot;sms&quot;:12");
    expect(html).toContain("&quot;whatsapp&quot;:5");
    expect(html).toContain("&quot;email&quot;:3");
  });
});
