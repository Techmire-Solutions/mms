import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  useExaminationsContractList,
  useExaminationsContractResults,
  useExaminationsContractBulkDelete,
  useExaminationsContractBulkRestore,
  useExaminationsContractBulkUpdateExams,
  useExaminationsContractBulkUpdateResults,
  useExaminationsContractDeleteExam,
  useExaminationsContractRestoreExam,
} from "./useExaminationsQueries";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("@/lib/api", () => ({
  tsrClient: {
    examinations: {
      listExams: {
        useQuery: () => ({
          data: { status: 200, body: { exams: [] } },
          isLoading: false,
        }),
      },
      listResults: {
        useQuery: () => ({
          data: { status: 200, body: { results: [] } },
          isLoading: false,
        }),
      },
      bulkDeleteExams: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      bulkRestoreExams: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      bulkUpdateExams: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      bulkUpdateResults: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      deleteExam: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      restoreExam: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
}));

describe("useExaminationsQueries", () => {
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

  it("provides contract queries and mutations", async () => {
    let listQuery!: ReturnType<typeof useExaminationsContractList>;
    let resultsQuery!: ReturnType<typeof useExaminationsContractResults>;
    let bulkDelete!: ReturnType<typeof useExaminationsContractBulkDelete>;
    let bulkRestore!: ReturnType<typeof useExaminationsContractBulkRestore>;
    let bulkUpdateExams!: ReturnType<typeof useExaminationsContractBulkUpdateExams>;
    let bulkUpdateResults!: ReturnType<typeof useExaminationsContractBulkUpdateResults>;
    let deleteExam!: ReturnType<typeof useExaminationsContractDeleteExam>;
    let restoreExam!: ReturnType<typeof useExaminationsContractRestoreExam>;

    function TestComponent() {
      listQuery = useExaminationsContractList();
      resultsQuery = useExaminationsContractResults();
      bulkDelete = useExaminationsContractBulkDelete();
      bulkRestore = useExaminationsContractBulkRestore();
      bulkUpdateExams = useExaminationsContractBulkUpdateExams();
      bulkUpdateResults = useExaminationsContractBulkUpdateResults();
      deleteExam = useExaminationsContractDeleteExam();
      restoreExam = useExaminationsContractRestoreExam();
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(listQuery.data.status).toBe(200);
    expect(resultsQuery.data.status).toBe(200);
    expect(bulkDelete.mutateAsync).toBeDefined();
    expect(bulkRestore.mutateAsync).toBeDefined();
    expect(bulkUpdateExams.mutateAsync).toBeDefined();
    expect(bulkUpdateResults.mutateAsync).toBeDefined();
    expect(deleteExam.mutateAsync).toBeDefined();
    expect(restoreExam.mutateAsync).toBeDefined();
  });
});
