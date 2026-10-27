import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  useExaminationsExams,
  useExaminationsExamsCollection,
  useExaminationsResults,
  useExaminationsResultsCollection,
  useExaminationsMetrics,
  useExaminationsMutations,
} from "./useExaminationsApi";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}));

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
          data: {
            status: 200,
            body: { exams: [{ id: "ex-1", name: "Tajweed" }] },
          },
          isLoading: false,
        }),
      },
      listResults: {
        useQuery: () => ({
          data: {
            status: 200,
            body: { results: [{ id: "r-1", marksObtained: 90 }] },
          },
          isLoading: false,
        }),
      },
      bulkUpdateExams: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }) },
      bulkUpdateResults: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }) },
      deleteExam: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }) },
      restoreExam: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }) },
      bulkDeleteExams: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }) },
      bulkRestoreExams: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }) },
    },
  },
}));

vi.mock("@/hooks/useServerMetrics", () => ({
  useServerMetrics: () => ({
    data: { total: 1, upcoming: 1, ongoing: 0, completed: 0, totalResults: 1, examsWithResults: 1 },
    isLoading: false,
  }),
}));

describe("useExaminationsApi Hooks", () => {
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

  it("provides examinations data queries, collections, metrics, and mutations", async () => {
    let examsResult!: ReturnType<typeof useExaminationsExams>;
    let examsCollection!: ReturnType<typeof useExaminationsExamsCollection>;
    let resultsQuery!: ReturnType<typeof useExaminationsResults>;
    let resultsCollection!: ReturnType<typeof useExaminationsResultsCollection>;
    let metricsResult!: ReturnType<typeof useExaminationsMetrics>;
    let mutationsResult!: ReturnType<typeof useExaminationsMutations>;

    function TestComponent() {
      examsResult = useExaminationsExams();
      examsCollection = useExaminationsExamsCollection();
      resultsQuery = useExaminationsResults();
      resultsCollection = useExaminationsResultsCollection();
      metricsResult = useExaminationsMetrics();
      mutationsResult = useExaminationsMutations();
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(examsResult.data.status).toBe(200);
    expect(examsCollection).toHaveLength(1);
    expect(resultsQuery.data.status).toBe(200);
    expect(resultsCollection).toHaveLength(1);
    expect(metricsResult.data?.total).toBe(1);
    expect(mutationsResult.replaceExams).toBeDefined();
    expect(mutationsResult.deleteExam).toBeDefined();
  });
});
