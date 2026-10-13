import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomWidgetCardLayout } from "./CustomWidgetCardLayout";

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

describe("CustomWidgetCardLayout", () => {
  it("renders computed card metrics with icon and title", () => {
    const mockCard = {
      id: "widget-1",
      title: "Active Madrasas",
      value: "18",
      sub: "Across 4 regions",
      icon: "building",
      color: "emerald",
      trend: 10,
    };

    const html = renderToStaticMarkup(<CustomWidgetCardLayout computedCard={mockCard} />);

    expect(html).toContain("Active Madrasas");
    expect(html).toContain("18");
    expect(html).toContain("Across 4 regions");
    expect(html).toContain("+10%");
  });
});
