import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Users } from "lucide-react";
import { StatCardBody } from "@/components/app/StatCardBody";

const mockColorTheme = {
  bg: "bg-primary/10",
  text: "text-primary",
  ring: "ring-primary/20",
  glow: "bg-primary/5",
};

describe("StatCardBody", () => {
  it("renders title, value, footer and icon", () => {
    const html = renderToStaticMarkup(
      <StatCardBody
        colorTheme={mockColorTheme}
        icon={<Users data-testid="user-icon" className="w-4 h-4 text-primary" />}
        value="1,450"
        title="Total Enrolled"
        footer="Updated 5m ago"
      />,
    );

    expect(html).toContain("1,450");
    expect(html).toContain("Total Enrolled");
    expect(html).toContain("Updated 5m ago");
    expect(html).toContain("bg-primary/10");
  });

  it("renders positive and negative trend badges", () => {
    const positiveHtml = renderToStaticMarkup(
      <StatCardBody
        colorTheme={mockColorTheme}
        icon={<Users className="w-4 h-4 text-primary" />}
        value="500"
        title="Active Students"
        trend={12}
      />,
    );

    expect(positiveHtml).toContain("+12%");

    const negativeHtml = renderToStaticMarkup(
      <StatCardBody
        colorTheme={mockColorTheme}
        icon={<Users className="w-4 h-4 text-primary" />}
        value="500"
        title="Active Students"
        trend={-8}
      />,
    );

    expect(negativeHtml).toContain("-8%");
  });

  it("renders actions slot when provided", () => {
    const html = renderToStaticMarkup(
      <StatCardBody
        colorTheme={mockColorTheme}
        icon={<Users className="w-4 h-4 text-primary" />}
        value="100"
        title="Test Metric"
        actions={<button type="button">Edit Action</button>}
      />,
    );

    expect(html).toContain("Edit Action");
  });
});
