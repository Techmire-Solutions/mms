import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { School } from "lucide-react";
import { FacultyPageView } from "./FacultyPageView";
import type { FacultyPageTabId } from "@/tenant/features/faculty/facultyPageWorkSubTabs";

vi.mock("@/components/ui/ModulePageShell", () => ({
  ModulePageShell: ({
    headerTitle,
    children,
    headerActions,
    metricsStrip,
  }: {
    headerTitle: string;
    children: React.ReactNode;
    headerActions?: React.ReactNode;
    metricsStrip?: React.ReactNode;
  }) => (
    <div data-testid="module-page-shell">
      <h1>{headerTitle}</h1>
      <div data-testid="header-actions">{headerActions}</div>
      <div>{metricsStrip}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("@/tenant/features/faculty/components/FacultyCommandMetrics", () => ({
  FacultyCommandMetrics: () => <div data-testid="faculty-metrics">Faculty Metrics</div>,
}));

vi.mock("@/components/ui/ResponsiveAccordionTabs", () => ({
  ResponsiveAccordionTabs: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="accordion-tabs">{children}</div>
  ),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/useIndustryTerminology", () => ({
  useIndustryTerminology: () => ({
    facultyLabel: "Faculty Team",
    staffSingular: "Teacher",
    locationLabel: "Campus",
  }),
}));

vi.mock("@/tenant/features/faculty/components/FacultyWorkTier", () => ({
  FacultyWorkTier: () => <div data-testid="faculty-work-tier">Faculty Directory</div>,
}));

vi.mock("@/tenant/features/faculty/components/FacultyDesignationsSetupSection", () => ({
  FacultyDesignationsSetupSection: () => <div>Designations Section</div>,
}));

vi.mock("@/tenant/features/faculty/components/FacultyPageOverlays", () => ({
  FacultyPageOverlays: () => <div data-testid="faculty-page-overlays">Faculty Overlays</div>,
}));

vi.mock("@/tenant/features/faculty/components/FacultyPageHeaderActions", () => ({
  FacultyPageHeaderActions: () => <div data-testid="faculty-dashboard-io">Dashboard IO</div>,
}));

vi.mock("@/tenant/features/faculty/components/FacultyTabIoToolbar", () => ({
  FacultyTabIoToolbar: ({ entity }: { entity: string }) => (
    <div data-testid="faculty-tab-io">Tab IO {entity}</div>
  ),
}));

describe("FacultyPageView Component", () => {
  const baseProps = {
    canWrite: true,
    canExport: true,
    visibleTabs: (
      [
        ["faculties", "Faculties", "Directory"],
        ["designations", "Designations", "Catalog"],
        ["reports", "Reports", "Analytics"],
        ["setup", "Setup", "Config"],
      ] as const
    ).map(([id, label, description]) => ({
      id: id as FacultyPageTabId,
      label,
      description,
      icon: School,
    })),
    showDirectoryActions: true,
    metricsTotal: 12,
    setActiveTab: vi.fn(),
    viewingDeleted: false,
    shownCount: 12,
    openCreateForm: vi.fn(),
    openCreateDepartment: vi.fn(),
    openCreateDesignation: vi.fn(),
    onExportEntity: vi.fn(),
    onImportEntity: vi.fn(),
    tabPanelProps: {
      activeTab: "faculties",
      workTierProps: {} as never,
    },
    pageOverlaysProps: {} as never,
  };

  it("shows dashboard IO without duplicate tab IO on faculties", () => {
    const html = renderToStaticMarkup(<FacultyPageView {...baseProps} activeTab="faculties" />);

    expect(html).toContain("Faculty Team");
    expect(html).toContain("Dashboard IO");
    expect(html).not.toContain("Tab IO");
    expect(html).toContain("Faculty Directory");
    expect(html).toContain("Faculty Overlays");
  });

  it("shows dashboard IO without duplicate tab IO on designations", () => {
    const html = renderToStaticMarkup(<FacultyPageView {...baseProps} activeTab="designations" />);

    expect(html).toContain("Dashboard IO");
    expect(html).not.toContain("Tab IO");
    expect(html).toContain("Designations Section");
    expect(html).not.toContain("Faculty Directory");
  });

  it("keeps dashboard IO on reports without scoped tab IO", () => {
    const html = renderToStaticMarkup(<FacultyPageView {...baseProps} activeTab="reports" />);

    expect(html).toContain("Dashboard IO");
    expect(html).not.toContain("Tab IO");
  });
});
