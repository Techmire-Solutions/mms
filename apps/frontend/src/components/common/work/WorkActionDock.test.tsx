import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkActionDock } from "./WorkActionDock";
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

describe("WorkActionDock", () => {
  it("renders nothing when selectedCount is 0", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkActionDock selectedCount={0} countLabel="0 selected" onClearSelection={vi.fn()} />
      </TestWrapper>,
    );
    expect(html).toBe("");
  });

  it("renders selection count, clear button, and lifecycle transition action", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkActionDock
          selectedCount={3}
          countLabel="3 items selected"
          onClearSelection={vi.fn()}
          clearLabel="Deselect all"
          transitions={[
            {
              id: "approve",
              label: "Approve Batch",
              tone: "primary",
              onClick: vi.fn(),
            },
          ]}
          exportAction={{
            onExport: vi.fn(),
            label: "Export Selected",
          }}
          deleteAction={{
            onDelete: vi.fn(),
            label: "Delete Selected",
          }}
        />
      </TestWrapper>,
    );

    expect(html).toContain("3 items selected");
    expect(html).toContain("Deselect all");
    expect(html).toContain("Approve Batch");
    expect(html).toContain("Export Selected");
    expect(html).toContain("Delete Selected");
  });
});
