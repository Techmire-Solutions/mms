import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useQuestionBankPageController } from "./useQuestionBankPageController";

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canWrite: true,
    canDelete: true,
    canReports: true,
    canViewSetup: true,
  }),
}));

vi.mock("@/tenant/hooks/useModuleTierTabs", () => ({
  useFilteredModuleTierTabs: () => [{ id: "work", label: "Question Bank" }],
}));

vi.mock("@/hooks/usePersistedTabState", () => ({
  usePersistedTabState: (_key: string, initial: string) => React.useState(initial),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/hooks/useDirectoryTrashState", () => ({
  useDirectoryTrashState: () => React.useState(false),
}));

vi.mock("@/tenant/features/question-bank/hooks/useQuestionBankConfig", () => ({
  useQuestionBankConfig: () => ({
    categories: [],
    difficulties: [],
    questionTypes: [],
  }),
}));

vi.mock("@/tenant/features/question-bank/hooks/useQuestionBankColumnLayout", () => ({
  useQuestionBankColumnLayout: () => ({}),
}));

vi.mock("@/tenant/features/question-bank/hooks/useQuestionBankApi", () => ({
  useQuestionBankQuestions: () => ({ isError: false, refetch: vi.fn() }),
  useQuestionBankQuestionsCollection: () => [],
  useQuestionBankTestsCollection: () => [],
  useQuestionBankResultsCollection: () => [],
  useQuestionBankMutations: () => ({
    replaceQuestions: { mutateAsync: vi.fn() },
    replaceTests: { mutateAsync: vi.fn() },
    deleteQuestion: { mutateAsync: vi.fn() },
    restoreQuestion: { mutateAsync: vi.fn() },
    bulkDeleteQuestions: { mutateAsync: vi.fn() },
    bulkRestoreQuestions: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/tenant/features/question-bank/hooks/useQuestionBankTrashActions", () => ({
  useQuestionBankTrashActions: () => ({
    handleDeleteQuestion: vi.fn(),
    handleRestoreQuestion: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleBulkRestore: vi.fn(),
  }),
}));

function renderQuestionBankControllerHook() {
  const result: { current: ReturnType<typeof useQuestionBankPageController> } = {} as {
    current: ReturnType<typeof useQuestionBankPageController>;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function HookHost() {
    result.current = useQuestionBankPageController();
    return null;
  }

  act(() => {
    root.render(<HookHost />);
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useQuestionBankPageController selection", () => {
  it("maintains stable clearSelection and handles selection toggling", () => {
    const { result, unmount } = renderQuestionBankControllerHook();
    try {
      expect(result.current.questionSelection.selectedIds).toEqual([]);
      const initialClear = result.current.questionSelection.clearSelection;

      act(() => result.current.questionSelection.toggleSelected("q-1", true));
      expect(result.current.questionSelection.selectedIds).toEqual(["q-1"]);
      expect(result.current.questionSelection.clearSelection).toBe(initialClear);

      act(() => result.current.questionSelection.toggleSelectAll(true, ["q-1", "q-2"]));
      expect(result.current.questionSelection.selectedIds).toEqual(["q-1", "q-2"]);

      act(() => result.current.questionSelection.clearSelection());
      expect(result.current.questionSelection.selectedIds).toEqual([]);
    } finally {
      unmount();
    }
  });

  it("select-all keeps ids outside the visible page", () => {
    const { result, unmount } = renderQuestionBankControllerHook();
    try {
      act(() => result.current.questionSelection.toggleSelected("other", true));
      act(() => result.current.questionSelection.toggleSelectAll(true, ["q-1", "q-2"]));
      expect(result.current.questionSelection.selectedIds).toEqual(["other", "q-1", "q-2"]);

      act(() => result.current.questionSelection.toggleSelectAll(false, ["q-1", "q-2"]));
      expect(result.current.questionSelection.selectedIds).toEqual(["other"]);
    } finally {
      unmount();
    }
  });

  it("clears question selection on trash toggle", () => {
    const { result, unmount } = renderQuestionBankControllerHook();
    try {
      act(() => result.current.questionSelection.toggleSelected("q-1", true));
      expect(result.current.questionSelection.selectedIds).toEqual(["q-1"]);

      act(() => result.current.setShowDeleted(true));
      expect(result.current.questionSelection.selectedIds).toEqual([]);
    } finally {
      unmount();
    }
  });
});
