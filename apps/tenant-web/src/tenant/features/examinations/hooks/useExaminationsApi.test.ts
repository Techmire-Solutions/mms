import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useQuery } from "@tanstack/react-query";
import { apiContract, tsrClient } from "@mms/fe-core/api/tsRest";
import {
  useExaminationsExams,
  useExaminationsExamsCollection,
  useExaminationsResults,
  useExaminationsResultsCollection,
  useExaminationsMetrics,
  useExaminationsMutations,
} from "./useExaminationsApi";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    // The marks hook pages through the endpoint; the test asserts wiring, not pagination.
    useQuery: vi.fn(() => ({
      data: {
        status: 200,
        body: { results: [{ id: "r-1", marksObtained: 90 }], hasMore: false },
      },
      isLoading: false,
    })),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("@mms/fe-core/api/tsRest", () => ({
  apiContract: {
    examinations: {
      listResults: vi.fn().mockResolvedValue({
        status: 200,
        body: {
          results: [{ id: "r-1", examId: "ex-1", studentId: "std-1", marksObtained: 90 }],
          hasMore: false,
        },
      }),
    },
  },
  tsrClient: {
    examinations: {
      listExams: {
        useQuery: vi.fn(() => ({
          data: {
            status: 200,
            body: { exams: [{ id: "ex-1", name: "Tajweed" }] },
          },
          isLoading: false,
        })),
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

vi.mock("@mms/fe-core/hooks", () => ({
  useServerMetrics: () => ({
    data: { total: 1, upcoming: 1, ongoing: 0, completed: 0, totalResults: 1, examsWithResults: 1 },
    isLoading: false,
  }),
}));

describe("useExaminationsApi Hooks", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(resultsQuery.data?.status).toBe(200);
    expect(resultsCollection).toHaveLength(1);
    expect(metricsResult.data?.total).toBe(1);
    expect(mutationsResult.replaceExams).toBeDefined();
    expect(mutationsResult.deleteExam).toBeDefined();
  });

  it("wires the exams query enabled gate from options and auth", async () => {
    function TestComponent() {
      useExaminationsExams({ enabled: false, includeDeleted: true });
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    const listExamsUseQuery = vi.mocked(tsrClient.examinations.listExams.useQuery);
    expect(listExamsUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, queryKey: expect.any(Array) }),
    );
  });

  it("passes the abort signal through the paginated results walk", async () => {
    const abort = new AbortController();

    function TestComponent() {
      useExaminationsResults();
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    const captured = vi.mocked(useQuery).mock.calls[0]?.[0];
    expect(captured?.queryFn).toBeTypeOf("function");
    const queryFn = captured?.queryFn as unknown as
      ((ctx: { signal: AbortSignal }) => Promise<unknown>) | undefined;
    if (!queryFn) throw new Error("results queryFn was not captured");
    await act(async () => {
      await queryFn({ signal: abort.signal });
    });

    const listResultsMock = vi.mocked(apiContract.examinations.listResults);
    expect(listResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: abort.signal,
        fetchOptions: { signal: abort.signal },
      }),
    );
  });
});
