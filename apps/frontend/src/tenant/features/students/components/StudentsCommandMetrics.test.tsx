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

  it("shows the unknown sentinel instead of a filtered total when metrics are absent", () => {
    // 2026-11-04 review (n1/X-05): it used to render the shown/filtered count as "Total"
    // and hard zeros for the rest while the metrics query was loading or failed.
    const html = renderToStaticMarkup(<StudentsCommandMetrics total={50} shown={10} />);

    expect(html).toContain("students.metrics.total");
    expect(html).toContain("—");
    expect(html).not.toContain(">50<");
    expect(html).toContain("students.metrics.filtered");
    expect(html).toContain("10");
  });

  it("renders an inline retry instead of authoritative zeros when metrics fail", () => {
    const onRetry = vi.fn();
    const html = renderToStaticMarkup(
      <StudentsCommandMetrics
        total={0}
        shown={0}
        serverMetrics={null}
        isError={true}
        onRetry={onRetry}
      />,
    );

    expect(html).toContain("students.loadFailed");
    expect(html).toContain("common.retry");
    expect(html).toContain("—");
  });
});
