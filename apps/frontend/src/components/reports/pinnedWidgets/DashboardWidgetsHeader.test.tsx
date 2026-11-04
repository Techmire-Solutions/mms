import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { DashboardWidgetsHeader } from "./DashboardWidgetsHeader";

describe("DashboardWidgetsHeader", () => {
  it("hides the density control from users who cannot save preferences", () => {
    const html = renderToStaticMarkup(
      <DashboardWidgetsHeader
        gridMode="comfortable"
        onToggleGridMode={() => {}}
        canCustomize={false}
      />,
    );

    expect(html).toContain("reports.widgets.pinnedPanels");
    expect(html).not.toContain("reports.widgets.comfortable");
    expect(html).not.toContain("reports.widgets.compact");
  });

  it("renders the density control for writers and keeps it out of print", () => {
    const html = renderToStaticMarkup(
      <DashboardWidgetsHeader gridMode="compact" onToggleGridMode={() => {}} canCustomize />,
    );

    expect(html).toContain("reports.widgets.comfortable");
    expect(html).toContain("reports.widgets.compact");
    expect(html).toContain("print:hidden");
    // Selected option is announced, not only coloured.
    expect(html).toContain('aria-pressed="true"');
  });
});
