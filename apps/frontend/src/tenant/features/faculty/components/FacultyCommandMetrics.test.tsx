import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyCommandMetrics } from "./FacultyCommandMetrics";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/faculty/hooks/useFaculty", () => ({
  useFacultyMetrics: () => ({
    data: {
      total: 25,
      active: 20,
      inactive: 5,
      onLeave: 0,
      other: 0,
      newThisPeriod: 2,
    },
  }),
}));

describe("FacultyCommandMetrics Component", () => {
  it("renders metric counters from server metrics and shown count", () => {
    const html = renderToStaticMarkup(<FacultyCommandMetrics total={25} shown={12} />);

    expect(html).toContain("faculty.metrics.total");
    expect(html).toContain("25");
    expect(html).toContain("faculty.metrics.filtered");
    expect(html).toContain("12");
    expect(html).toContain("faculty.metrics.active");
    expect(html).toContain("20");
    expect(html).toContain("faculty.leave.onLeave");
  });
});
