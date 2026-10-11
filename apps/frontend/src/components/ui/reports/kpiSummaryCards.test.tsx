import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KPICardsGrid } from "./kpiSummaryCards";
import { Users } from "lucide-react";
import type { CategorizedKPIItem } from "./kpiSummaryTypes";

const mockCards: CategorizedKPIItem[] = [
  {
    id: "kpi-1",
    label: "Total Students",
    value: "1,240",
    color: "primary",
    trend: "up",
    icon: Users,
    velocity: "+5.2%",
    sub: "Active enrollments",
    categories: ["students"],
    isAvailable: true,
  },
];

describe("KPICardsGrid Component", () => {
  it("renders KPI cards with labels, values, trends, and custom button", () => {
    const html = renderToStaticMarkup(<KPICardsGrid cards={mockCards} onAddCustom={vi.fn()} />);

    expect(html).toContain("Total Students");
    expect(html).toContain("1,240");
    expect(html).toContain("+5.2%");
    expect(html).toContain("Active enrollments");
    expect(html).toContain("reports.kpiAddCustom");
  });
});
