import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsViewStats } from "./ResultsViewStats";

describe("ResultsViewStats Component", () => {
  it("renders statistics cards with total, average, passed, failed", () => {
    const html = renderToStaticMarkup(
      <ResultsViewStats
        stats={{
          total: 20,
          average: 82,
          passed: 18,
          failed: 2,
        }}
        t={((key: string) => key) as unknown as never}
      />,
    );

    expect(html).toContain("20");
    expect(html).toContain("82%");
    expect(html).toContain("18");
    expect(html).toContain("2");
    expect(html).toContain("examinations.stats.students");
    expect(html).toContain("examinations.stats.classAvg");
  });
});
