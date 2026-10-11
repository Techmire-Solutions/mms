import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleScaffold, ModuleScaffoldSkeleton } from "@/components/common/ModuleScaffold";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";

const mockContext = {
  language: "en",
  t: ((key: string) => key) as TranslationFunction,
  isLoading: false,
  dir: "ltr" as const,
  isRtl: false,
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <TranslationContext.Provider value={mockContext}>{children}</TranslationContext.Provider>;
}

describe("ModuleScaffold", () => {
  it("renders SEO metadata, header, and children correctly", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <ModuleScaffold
          seoTitle="Students Directory | MMS"
          seoDescription="Manage student records and admissions"
          headerTitle="Students"
          headerSubtitle="Active enrolled directory"
          metricsStrip={<div id="test-metrics">Metrics Content</div>}
        >
          <div id="test-content">Main Directory Content</div>
        </ModuleScaffold>
      </TestWrapper>,
    );

    expect(html).toContain("<title>Students Directory | MMS</title>");
    expect(html).toContain('name="description" content="Manage student records and admissions"');
    expect(html).toContain("Students");
    expect(html).toContain("Active enrolled directory");
    expect(html).toContain("Metrics Content");
    expect(html).toContain("Main Directory Content");
  });

  it("renders tabs when tabs configuration is provided", () => {
    const tabs = [
      { id: "work", label: "Directory" },
      { id: "reports", label: "Analytics" },
      { id: "setup", label: "Settings" },
    ];

    const html = renderToStaticMarkup(
      <TestWrapper>
        <ModuleScaffold
          seoTitle="Finance | MMS"
          seoDescription="Finance management"
          tabs={tabs}
          activeTab="work"
          onTabChange={() => {}}
        >
          <div>Tab Content</div>
        </ModuleScaffold>
      </TestWrapper>,
    );

    expect(html).toContain("Directory");
    expect(html).toContain("Analytics");
    expect(html).toContain("Settings");
    expect(html).toContain("Tab Content");
  });

  it("renders ModuleScaffoldSkeleton with accessible role and pulse animations", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <ModuleScaffoldSkeleton />
      </TestWrapper>,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading module content...");
    expect(html).toContain("animate-pulse");
  });

  it("renders ModuleScaffoldSkeleton without optional elements when configured", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <ModuleScaffoldSkeleton
          showHeader={false}
          showMetrics={false}
          showTabs={false}
          showFilterBar={false}
        />
      </TestWrapper>,
    );

    expect(html).toContain('role="status"');
    expect(html).not.toContain("w-44"); // title skeleton omitted
  });

  it("applies aria-busy='true' on wrapper when isBusy=true and omits when false/undefined", () => {
    const busyHtml = renderToStaticMarkup(
      <TestWrapper>
        <ModuleScaffold
          seoTitle="Busy Test | MMS"
          seoDescription="Testing busy state"
          isBusy={true}
        >
          <div>Body</div>
        </ModuleScaffold>
      </TestWrapper>,
    );
    expect(busyHtml).toContain('aria-busy="true"');

    const idleHtml = renderToStaticMarkup(
      <TestWrapper>
        <ModuleScaffold
          seoTitle="Idle Test | MMS"
          seoDescription="Testing idle state"
          isBusy={false}
        >
          <div>Body</div>
        </ModuleScaffold>
      </TestWrapper>,
    );
    expect(idleHtml).not.toContain('aria-busy="true"');
  });

  it("renders drawerOutlet outside the main content flow", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <ModuleScaffold
          seoTitle="Drawer Outlet Test | MMS"
          seoDescription="Testing drawer outlet placement"
          drawerOutlet={<div id="test-drawer-portal">Slide-over Portal Content</div>}
        >
          <div id="test-main-body">Main Grid Content</div>
        </ModuleScaffold>
      </TestWrapper>,
    );

    expect(html).toContain("test-drawer-portal");
    expect(html).toContain("Slide-over Portal Content");
    expect(html).toContain("test-main-body");

    // Verify drawerOutlet appears after the main content wrapper closes
    const mainBodyIndex = html.indexOf("test-main-body");
    const drawerPortalIndex = html.indexOf("test-drawer-portal");
    expect(drawerPortalIndex).toBeGreaterThan(mainBodyIndex);
  });
});
