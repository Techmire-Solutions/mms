import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsCommandMetrics } from "./EnrollmentsCommandMetrics";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({
    formatCurrency: (val: number) => `$${val}`,
    activeCurrency: { code: "USD" },
  }),
}));

vi.mock("@/tenant/features/enrollments/hooks/useEnrollmentsApi", () => ({
  useEnrollmentsMetrics: () => ({
    data: {
      total: 100,
      confirmed: 80,
      pending: 15,
      cancelled: 5,
      revenue: 50000,
      newThisPeriod: 10,
    },
  }),
}));

describe("EnrollmentsCommandMetrics Component", () => {
  it("renders metrics grid cards", () => {
    const html = renderToStaticMarkup(<EnrollmentsCommandMetrics total={100} shown={50} />);

    expect(html).toContain("enrollments.metrics.total");
    expect(html).toContain("100");
    expect(html).toContain("enrollments.metrics.filtered");
    expect(html).toContain("50");
    expect(html).toContain("enrollments.metrics.confirmed");
    expect(html).toContain("80");
  });
});
