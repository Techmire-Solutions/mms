import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ModuleReports from "./ModuleReports";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/tenant/features/reports/components/ModuleReportsToolPanels", () => ({
  ModuleReportsToolPanels: ({
    activeTab,
    onClosePanel,
    onApplySavedFilters,
    onVisualizerSave,
    onVisualizerClose,
  }: {
    activeTab: string;
    onClosePanel: () => void;
    onApplySavedFilters: (filters: Record<string, unknown>) => void;
    onVisualizerSave: () => void;
    onVisualizerClose: () => void;
  }) => (
    <div data-testid="mock-tool-panels">
      <span>ActivePanel: {activeTab}</span>
      <button id="btn-close-panel" onClick={onClosePanel}>
        ClosePanel
      </button>
      <button id="btn-apply-saved" onClick={() => onApplySavedFilters({ session: "2026-2027" })}>
        ApplySaved
      </button>
      <button id="btn-save-visualizer" onClick={onVisualizerSave}>
        SaveVisualizer
      </button>
      <button id="btn-close-visualizer" onClick={onVisualizerClose}>
        CloseVisualizer
      </button>
    </div>
  ),
  getInitialReportCollection: vi.fn(() => []),
}));

vi.mock("@/tenant/features/reports/components/ReportFilters", () => ({
  default: ({
    category,
    filters,
    onChange,
  }: {
    category: string;
    filters: Record<string, unknown>;
    onChange: (f: Record<string, unknown>) => void;
  }) => (
    <div data-testid="mock-filters">
      <span>Category: {category}</span>
      <button
        id="btn-set-student-filter"
        onClick={() => onChange({ ...filters, student: "Ahmed" })}
      >
        SetStudentFilter
      </button>
    </div>
  ),
}));

vi.mock("@/tenant/features/reports/components/moduleReportRegistry", () => ({
  MODULE_REPORT_REGISTRY: {
    students: {
      hasInternalFilters: false,
      render: ({ onEditVisual }: { onEditVisual: (cfg: unknown) => void }) => (
        <div data-testid="students-report-render">
          Students Report Content
          <button
            id="btn-trigger-edit-visual"
            onClick={() => onEditVisual({ chartType: "bar", title: "Custom Chart" })}
          >
            TriggerEditVisual
          </button>
        </div>
      ),
    },
    contacts: {
      hasInternalFilters: true,
      render: () => <div data-testid="contacts-report-render">Contacts Report Content</div>,
    },
  },
}));

describe("ModuleReports", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders report header, default filters, and dashboard for students", async () => {
    await act(async () => {
      root.render(<ModuleReports category="students" />);
    });

    expect(container.textContent).toContain("reports.moduleTools.title");
    expect(container.querySelector('[data-testid="students-report-render"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mock-filters"]')).not.toBeNull();
  });

  it("omits external filters when module report registry indicates hasInternalFilters", async () => {
    await act(async () => {
      root.render(<ModuleReports category="contacts" />);
    });

    expect(container.querySelector('[data-testid="contacts-report-render"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mock-filters"]')).toBeNull();
  });

  it("allows switching subtab using select or subtab buttons", async () => {
    await act(async () => {
      root.render(<ModuleReports category="students" />);
    });

    const select = container.querySelector("select");
    expect(select).not.toBeNull();

    await act(async () => {
      if (select) {
        select.value = "compare";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(container.textContent).toContain("ActivePanel: compare");
  });

  it("handles onEditVisual and tool panel callbacks correctly", async () => {
    await act(async () => {
      root.render(<ModuleReports category="students" />);
    });

    // Trigger edit visualizer
    await act(async () => {
      container.querySelector<HTMLButtonElement>("#btn-trigger-edit-visual")?.click();
    });
    expect(container.textContent).toContain("ActivePanel: visualizer");

    // Trigger close panel
    await act(async () => {
      container.querySelector<HTMLButtonElement>("#btn-close-panel")?.click();
    });
    expect(container.textContent).toContain("ActivePanel: dashboard");

    // Trigger apply saved filters
    await act(async () => {
      container.querySelector<HTMLButtonElement>("#btn-apply-saved")?.click();
    });
    expect(container.textContent).toContain("ActivePanel: dashboard");

    // Trigger save visualizer
    await act(async () => {
      container.querySelector<HTMLButtonElement>("#btn-trigger-edit-visual")?.click();
    });
    expect(container.textContent).toContain("ActivePanel: visualizer");
    await act(async () => {
      container.querySelector<HTMLButtonElement>("#btn-save-visualizer")?.click();
    });
    expect(container.textContent).toContain("ActivePanel: dashboard");

    // Trigger close visualizer
    await act(async () => {
      container.querySelector<HTMLButtonElement>("#btn-trigger-edit-visual")?.click();
    });
    expect(container.textContent).toContain("ActivePanel: visualizer");
    await act(async () => {
      container.querySelector<HTMLButtonElement>("#btn-close-visualizer")?.click();
    });
    expect(container.textContent).toContain("ActivePanel: dashboard");
  });

  it("updates filters via ReportFilters onChange", async () => {
    await act(async () => {
      root.render(<ModuleReports category="students" />);
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>("#btn-set-student-filter")?.click();
    });

    expect(container.querySelector('[data-testid="students-report-render"]')).not.toBeNull();
  });
});
