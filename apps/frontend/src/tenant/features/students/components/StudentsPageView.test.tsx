import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GraduationCap } from "lucide-react";
import { StudentsPageView } from "./StudentsPageView";

vi.mock("@/components/app/ModulePageShell", () => ({
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
      <div>{headerActions}</div>
      <div>{metricsStrip}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("@/tenant/features/students/components/StudentsCommandMetrics", () => ({
  StudentsCommandMetrics: () => <div data-testid="students-metrics">Metrics</div>,
}));

vi.mock("@/components/app/ResponsiveAccordionTabs", () => ({
  ResponsiveAccordionTabs: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="accordion-tabs">{children}</div>
  ),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/students/components/StudentsWorkTier", () => ({
  StudentsWorkTier: () => <div data-testid="students-work-tier">Work Tier</div>,
}));

vi.mock("@/tenant/features/students/components/StudentsPageOverlays", () => ({
  StudentsPageOverlays: () => <div data-testid="students-page-overlays">Overlays</div>,
}));

describe("StudentsPageView Component", () => {
  it("renders page shell with header actions, metrics, and work tier", () => {
    const html = renderToStaticMarkup(
      <StudentsPageView
        canWrite={true}
        canExport={true}
        visibleTabs={[
          {
            id: "work",
            label: "Students",
            description: "Directory",
            icon: GraduationCap,
          },
        ]}
        metricsTotal={25}
        metricsSnapshot={null}
        activeTab="work"
        setActiveTab={vi.fn()}
        viewingDeleted={false}
        shownCount={25}
        openCreateForm={vi.fn()}
        handleExportCSV={vi.fn()}
        tabPanelProps={{
          activeTab: "work",
          workTierProps: {} as never,
        }}
        pageOverlaysProps={{} as never}
      />,
    );

    expect(html).toContain("nav.students");
    expect(html).toContain("Work Tier");
    expect(html).toContain("Overlays");
  });
});
