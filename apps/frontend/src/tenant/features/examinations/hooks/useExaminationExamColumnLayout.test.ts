import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useExaminationExamColumnLayout } from "./useExaminationExamColumnLayout";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useModuleColumnLayout", () => ({
  useModuleColumnLayout: ({ tenantRegistry }: { tenantRegistry: unknown }) => ({
    isColumnVisible: (_key: string) => true,
    getColumnWidth: (_key: string) => 150,
    setColumnWidth: vi.fn(),
    columnRegistry: tenantRegistry,
    updateUserColumnLayout: vi.fn(),
    customizerLabels: {},
  }),
}));

describe("useExaminationExamColumnLayout Hook", () => {
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

  it("builds exam work column registry and layout controls", async () => {
    let hookResult!: ReturnType<typeof useExaminationExamColumnLayout>;

    function TestComponent() {
      hookResult = useExaminationExamColumnLayout();
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult.isColumnVisible("name")).toBe(true);
    expect(hookResult.columnRegistry).toBeDefined();
  });
});
