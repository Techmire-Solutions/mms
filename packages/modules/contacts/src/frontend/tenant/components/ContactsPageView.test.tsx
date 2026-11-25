import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Users } from "lucide-react";
import { ContactsPageView } from "./ContactsPageView.js";

vi.mock("@mms/fe-core/components/ModulePageShell", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
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

vi.mock("@mms/fe-core/components/ResponsiveAccordionTabs", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  ResponsiveAccordionTabs: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="accordion-tabs">{children}</div>
  ),
}));

vi.mock("./ContactsCommandMetrics.js", () => ({
  ContactsCommandMetrics: () => <div data-testid="contacts-metrics">Metrics</div>,
}));

vi.mock("./ContactsDataBanner.js", () => ({
  default: () => <div data-testid="data-banner">Banner</div>,
}));

vi.mock("./ContactsSyncConflictPanel.js", () => ({
  default: () => <div data-testid="conflict-panel">Conflict Panel</div>,
}));

vi.mock("./ContactsPageOverlays.js", () => ({
  ContactsPageOverlays: () => <div data-testid="page-overlays">Overlays</div>,
}));

vi.mock("./ContactsWorkTier.js", () => ({
  ContactsWorkTier: () => <div data-testid="work-tier">Work Tier</div>,
}));

let lastHeaderProps: { isExporting: boolean; onImport?: () => void } | undefined;

/** Accessor defeats TS control-flow narrowing of the module-level capture. */
function getLastHeaderProps(): { isExporting: boolean; onImport?: () => void } | undefined {
  return lastHeaderProps;
}

vi.mock("./ContactsPageHeaderActions.js", () => ({
  ContactsPageHeaderActions: ({
    isExporting,
    onImport,
  }: {
    isExporting?: boolean;
    onImport?: () => void;
  }) => {
    lastHeaderProps = { isExporting: Boolean(isExporting), onImport };
    return (
      <div data-testid="header-actions" data-exporting={String(Boolean(isExporting))}>
        <button type="button" data-testid="header-import" onClick={onImport}>
          import
        </button>
      </div>
    );
  },
}));

const baseProps: React.ComponentProps<typeof ContactsPageView> = {
  t: ((key: string) => key) as never,
  visibleTopTabs: [{ id: "work", label: "Contacts", description: "Directory", icon: Users }],
  effectiveTab: "work",
  setActiveTab: vi.fn(),
  canExport: true,
  canRead: true,
  canWrite: true,
  viewingDeleted: false,
  openingDuplicates: false,
  isExporting: false,
  handleOpenDuplicates: vi.fn(),
  handleExportCSV: vi.fn(),
  handleOpenImport: vi.fn(),
  handleOpenCsvImport: vi.fn(),
  handleNew: vi.fn(),
  shownCount: 10,
  pendingCount: 0,
  conflictCount: 0,
  flushing: false,
  flush: vi.fn(),
  openConflictReview: vi.fn(),
  conflictPanelOpen: false,
  setConflictPanelOpen: vi.fn(),
  tabPanelProps: {
    workTierProps: {} as never,
    setupTierProps: {} as never,
  },
  overlayProps: {} as never,
};

function render(overrides: Partial<React.ComponentProps<typeof ContactsPageView>> = {}) {
  return renderToStaticMarkup(<ContactsPageView {...baseProps} {...overrides} />);
}

describe("ContactsPageView Component", () => {
  it("renders presentational contacts page with header, tabs, and work tier", () => {
    const html = render();

    expect(html).toContain("nav.contacts");
    expect(html).toContain("Work Tier");
    expect(html).toContain("Overlays");
    expect(html).toContain('data-exporting="false"');
  });

  it("passes the in-flight export state to the header actions", () => {
    expect(render({ isExporting: true })).toContain('data-exporting="true"');
  });

  it("wires the header import CTA to the import opener", () => {
    const handleOpenImport = vi.fn();
    const html = render({ handleOpenImport });
    const headerProps = getLastHeaderProps();

    expect(html).toContain('data-testid="header-import"');
    expect(headerProps?.onImport).toBe(handleOpenImport);
    headerProps?.onImport?.();
    expect(handleOpenImport).toHaveBeenCalledTimes(1);
  });
});
