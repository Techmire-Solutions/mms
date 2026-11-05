import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/reports/pinnedWidgets/WidgetBuilder", () => ({
  WidgetBuilder: () => <div data-testid="widget-builder" />,
}));
vi.mock("@/tenant/components/reports/pinnedWidgetsFacade", () => ({
  CustomWidgetRenderer: () => null,
}));
vi.mock("@/tenant/features/dashboard/components/DashboardCustomizeWidgetsSection", () => ({
  DashboardCustomizeWidgetsSection: () => <div data-testid="widgets-section" />,
}));

import { DashboardCustomizePanel } from "./DashboardCustomizePanel";
import type { DashboardCustomizePanelProps } from "@/tenant/features/dashboard/lib/dashboardCustomizePanelTypes";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const baseProps: DashboardCustomizePanelProps = {
  can: () => true,
  customWidgets: [],
  disabledCardIds: [],
  toggleCardVisibility: vi.fn(),
  dashboardMetricCards: [
    {
      id: "students",
      title: "Students",
      value: "10",
      sub: "",
      icon: "users",
      color: "emerald",
      trend: 0,
    },
  ],
  selectedDashboardCardCount: 1,
  pinnedDashboardWidgetCount: 0,
  isWidgetBuilderOpen: false,
  editingWidget: null,
  widgetBuilderType: "card",
  onCloseBuilder: vi.fn(),
  onSaveWidget: vi.fn(),
  onEditWidget: vi.fn(),
  onDeleteWidget: vi.fn(),
  onToggleWidgetPin: vi.fn(),
  onOpenWidgetBuilder: vi.fn(),
  onDone: vi.fn(),
};

describe("DashboardCustomizePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  const render = (props: Partial<DashboardCustomizePanelProps> = {}) =>
    act(() => {
      root.render(<DashboardCustomizePanel {...baseProps} {...props} />);
    });

  it("is an addressable region that never prints", () => {
    render();

    const region = container.querySelector("#dashboard-customize-panel");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("region");
    expect(region?.className).toContain("print:hidden");
  });

  it("offers a Done action at the end of the panel", async () => {
    render();

    const done = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("dashboard.exitCustomization"),
    );
    expect(done).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      done?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(baseProps.onDone).toHaveBeenCalledTimes(1);
  });

  it("no longer duplicates the pinned-panels density control", () => {
    render();

    expect(container.textContent).not.toContain("dashboard.layoutDensity");
    expect(container.textContent).not.toContain("dashboard.densityComfortable");
  });

  it("reveals and focuses the builder when it opens", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render();
    await act(async () => {
      root.render(
        <DashboardCustomizePanel {...baseProps} isWidgetBuilderOpen editingWidget={null} />,
      );
    });

    expect(container.querySelector("[data-testid='widget-builder']")).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
