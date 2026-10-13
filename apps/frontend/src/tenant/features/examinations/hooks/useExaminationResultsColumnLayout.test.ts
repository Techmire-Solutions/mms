import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useExaminationResultsColumnLayout } from "./useExaminationResultsColumnLayout";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useModuleColumnLayout", () => ({
  useModuleColumnLayout: ({ tenantRegistry }: any) => ({
    isColumnVisible: (_key: string) => true,
    getColumnWidth: (_key: string) => 120,
    setColumnWidth: vi.fn(),
    columnRegistry: tenantRegistry,
    updateUserColumnLayout: vi.fn(),
    customizerLabels: {},
  }),
}));

describe("useExaminationResultsColumnLayout Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    return () => {
      if (container) {
        container.remove();
        container = null;
      }
    };
  });

  it("builds results work column registry and layout controls", async () => {
    let hookResult: any;

    function TestComponent() {
      hookResult = useExaminationResultsColumnLayout();
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult.isColumnVisible("rank")).toBe(true);
    expect(hookResult.columnRegistry).toBeDefined();
  });
});
