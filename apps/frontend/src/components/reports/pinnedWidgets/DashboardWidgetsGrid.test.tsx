import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { DashboardWidgetsGrid } from "./DashboardWidgetsGrid";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

const widget = {
  id: "custom-1",
  title: "Custom widget",
  category: "students",
  collection: "students",
  widgetType: "kpi",
  operation: "count",
  color: "emerald",
  isPinnedToDashboard: true,
} as CustomWidget;

const renderGrid = (props: Partial<Parameters<typeof DashboardWidgetsGrid>[0]> = {}) =>
  renderToStaticMarkup(
    <DashboardWidgetsGrid
      widgets={[widget]}
      gridMode="comfortable"
      isEditMode={false}
      onUnpin={() => {}}
      onEditWidget={() => {}}
      onDeleteWidget={() => {}}
      renderWidget={() => <div>{widget.title}</div>}
      {...props}
    />,
  );

describe("DashboardWidgetsGrid", () => {
  it("hides every widget action while not customizing", () => {
    const html = renderGrid();

    expect(html).toContain("Custom widget");
    expect(html).not.toContain("reports.widgets.unpinWidget");
    expect(html).not.toContain("reports.widgets.editWidget");
    expect(html).not.toContain("reports.widgets.deleteWidget");
  });

  it("shows edit, delete and unpin inside customize mode without hover reveal", () => {
    const html = renderGrid({ isEditMode: true });

    expect(html).toContain("reports.widgets.editWidget");
    expect(html).toContain("reports.widgets.deleteWidget");
    expect(html).toContain("reports.widgets.unpinWidget");
    // Actions must not depend on `md:group-hover`, which left customize mode inert.
    expect(html).not.toContain("md:group-hover:opacity-100");
  });

  it("never offers delete for a seeded widget", () => {
    const html = renderGrid({
      isEditMode: true,
      widgets: [{ ...widget, id: "def-card-admin-students" }],
    });

    expect(html).toContain("reports.widgets.unpinWidget");
    expect(html).not.toContain("reports.widgets.deleteWidget");
  });
});
