import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const controller = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));

vi.mock("@/tenant/features/sessions/hooks/useSessionsPageController", () => ({
  useSessionsPageController: () => controller.current,
}));

vi.mock("@/tenant/features/sessions/components/SessionsCommandMetrics", () => ({
  SessionsCommandMetrics: () => <div data-testid="command-metrics" />,
}));
vi.mock("@/tenant/features/sessions/components/SessionsWorkTier", () => ({
  SessionsWorkTier: () => <div data-testid="work-tier" />,
}));
vi.mock("@/tenant/features/sessions/components/SessionsDialogLayer", () => ({
  SessionsDialogLayer: () => <div data-testid="dialog-layer" />,
}));
vi.mock("@/components/app/PageHelpCallout", () => ({ PageHelpCallout: () => null }));

vi.mock("@/components/app/ModuleTierPage", () => ({
  ModuleTierPage: ({
    tiers,
    activeTab,
    tabs,
  }: {
    tiers: Array<{ id: string }>;
    activeTab: string;
    tabs: Array<{ id: string }>;
  }) => (
    <div
      data-testid="tier-page"
      data-tiers={tiers.map((tier) => tier.id).join(",")}
      data-tabs={tabs.map((tab) => tab.id).join(",")}
      data-active={activeTab}
    />
  ),
}));

import Sessions from "./SessionsPage";

function baseController(overrides: Record<string, unknown>) {
  return {
    t: (key: string) => key,
    canExport: true,
    canWrite: true,
    canDelete: true,
    showDeleted: false,
    shownCount: 0,
    sessions: [],
    selectedIds: [],
    PAGE_TABS: [{ id: "work", label: "Sessions" }],
    activeTab: "work",
    setActiveTab: vi.fn(),
    handleExportCSV: vi.fn(),
    openCreateForm: vi.fn(),
    handleBulkExport: vi.fn(),
    ...overrides,
  };
}

describe("SessionsPage tier filtering", () => {
  it("does not mount a hidden setup tier", () => {
    controller.current = baseController({ PAGE_TABS: [{ id: "work", label: "Sessions" }] });
    const html = renderToStaticMarkup(<Sessions />);
    expect(html).toContain('data-tiers="work"');
    expect(html).not.toContain("setup");
  });

  it("mounts setup only when the permission-filtered tab is visible", () => {
    controller.current = baseController({
      PAGE_TABS: [
        { id: "work", label: "Sessions" },
        { id: "setup", label: "Setup" },
      ],
      activeTab: "setup",
    });
    const html = renderToStaticMarkup(<Sessions />);
    expect(html).toContain('data-tiers="work,setup"');
    expect(html).toContain('data-active="setup"');
  });
});
