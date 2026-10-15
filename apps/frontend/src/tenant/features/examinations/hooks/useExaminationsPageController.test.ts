import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useExaminationsPageController } from "./useExaminationsPageController";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canWrite: true,
    canDelete: true,
    canReports: true,
    canViewSetup: true,
    canEditSetup: true,
  }),
}));

vi.mock("@/tenant/hooks/useModuleTierTabs", () => ({
  useFilteredModuleTierTabs: () => [
    { id: "work", label: "Examinations" },
    { id: "reports", label: "Reports" },
    { id: "setup", label: "Setup" },
  ],
}));

vi.mock("@/hooks/usePersistedTabState", () => ({
  usePersistedTabState: (_key: string, defaultVal: string) => [defaultVal, vi.fn()],
}));

vi.mock("@/hooks/useModuleShortcuts", () => ({
  useModuleShortcuts: vi.fn(),
}));

vi.mock("./useExaminationExamColumnLayout", () => ({
  useExaminationExamColumnLayout: () => ({
    isColumnVisible: () => true,
    getColumnWidth: () => undefined,
    setColumnWidth: vi.fn(),
    columnRegistry: {},
    updateUserColumnLayout: vi.fn(),
    customizerLabels: {},
  }),
}));

vi.mock("./useExaminationResultsColumnLayout", () => ({
  useExaminationResultsColumnLayout: () => ({
    isColumnVisible: () => true,
    columnRegistry: {},
    updateUserColumnLayout: vi.fn(),
    customizerLabels: {},
  }),
}));

vi.mock("./useExaminationsApi", () => ({
  useExaminationsExams: () => ({
    data: { status: 200, body: [{ id: "ex-1", name: "Tajweed" }] },
    isError: false,
    refetch: vi.fn(),
  }),
  useExaminationsResults: () => ({
    data: { status: 200, body: [{ id: "r-1", marksObtained: 90 }] },
    isError: false,
  }),
  useExaminationsMutations: () => ({
    replaceExams: { mutateAsync: vi.fn() },
    replaceExamResults: { mutateAsync: vi.fn() },
    deleteExam: { mutateAsync: vi.fn() },
    restoreExam: { mutateAsync: vi.fn() },
    bulkDeleteExams: { mutateAsync: vi.fn() },
    bulkRestoreExams: { mutateAsync: vi.fn() },
  }),
}));

describe("useExaminationsPageController Hook", () => {
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

  it("orchestrates page controller state and modal handlers", async () => {
    let hookResult!: ReturnType<typeof useExaminationsPageController>;

    function TestComponent() {
      hookResult = useExaminationsPageController();
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(TestComponent)));
    });

    expect(hookResult.effectiveTab).toBe("work");
    expect(hookResult.effectiveSubTab).toBe("exams");
    expect(hookResult.exams).toHaveLength(1);
    expect(hookResult.canWrite).toBe(true);

    await act(async () => {
      hookResult.openCreateExam();
    });
    expect(hookResult.showExamForm).toBe(true);
  });
});
