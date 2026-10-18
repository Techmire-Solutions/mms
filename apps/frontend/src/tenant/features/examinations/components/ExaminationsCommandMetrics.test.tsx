import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsCommandMetrics } from "./ExaminationsCommandMetrics";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/examinations/hooks/useExaminationsApi", () => ({
  useExaminationsMetrics: () => ({
    data: {
      total: 10,
      upcoming: 2,
      ongoing: 3,
      completed: 5,
      totalResults: 50,
      examsWithResults: 5,
    },
    isLoading: false,
  }),
}));

vi.mock("@/components/app/ModuleCommandMetricsGrid", () => ({
  ModuleCommandMetricsGrid: ({
    items,
  }: {
    items: Array<{ label: string; value: React.ReactNode }>;
  }) => (
    <div data-testid="metrics-grid">
      {items.map((item: { label: string; value: React.ReactNode }) => (
        <span key={item.label}>
          {item.label}:{item.value}
        </span>
      ))}
    </div>
  ),
}));

describe("ExaminationsCommandMetrics Component", () => {
  it("renders total, filtered, upcoming, and ongoing metric counts", () => {
    const html = renderToStaticMarkup(<ExaminationsCommandMetrics shown={4} total={10} />);

    expect(html).toContain("examinations.metrics.total:10");
    expect(html).toContain("examinations.metrics.filtered:4");
    expect(html).toContain("examinations.metrics.upcoming:2");
    expect(html).toContain("examinations.metrics.ongoing:3");
  });
});
