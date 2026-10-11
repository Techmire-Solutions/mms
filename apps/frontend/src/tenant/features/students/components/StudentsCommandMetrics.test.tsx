import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentsCommandMetrics } from "./StudentsCommandMetrics";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("StudentsCommandMetrics Component", () => {
  it("renders metric counters from serverMetrics prop and shown count", () => {
    const html = renderToStaticMarkup(
      <StudentsCommandMetrics
        total={100}
        shown={42}
        serverMetrics={{
          total: 100,
          active: 85,
          inactive: 15,
          suspended: 0,
          newThisPeriod: 5,
        }}
      />,
    );

    expect(html).toContain("students.metrics.total");
    expect(html).toContain("100");
    expect(html).toContain("students.metrics.filtered");
    expect(html).toContain("42");
    expect(html).toContain("students.metrics.active");
    expect(html).toContain("85");
    expect(html).toContain("students.metrics.inactive");
    expect(html).toContain("15");
    expect(html).toContain("students.metrics.newThisPeriod");
    expect(html).toContain("5");
  });

  it("falls back to total prop when serverMetrics is not provided", () => {
    const html = renderToStaticMarkup(<StudentsCommandMetrics total={50} shown={10} />);

    expect(html).toContain("students.metrics.total");
    expect(html).toContain("50");
    expect(html).toContain("students.metrics.filtered");
    expect(html).toContain("10");
  });
});
