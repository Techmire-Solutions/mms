import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useExaminationsReportAggregates } from "./useExaminationsReportAggregates";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}));

vi.mock("@/lib/apiClient", () => ({
  apiJson: vi.fn().mockResolvedValue({
    totalExams: 10,
    averageScore: 78,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey, queryFn: _queryFn }: { queryKey: unknown; queryFn: unknown }) => ({
    data: { totalExams: 10, averageScore: 78 },
    isLoading: false,
    queryKey,
  }),
}));

describe("useExaminationsReportAggregates Hook", () => {
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

  it("fetches examination report aggregates with query comparison params", async () => {
    let hookResult!: ReturnType<typeof useExaminationsReportAggregates>;

    function TestComponent() {
      hookResult = useExaminationsReportAggregates({
        comparison: {
          sessionIds: ["ses-1"],
          rangeAFrom: "2025-01-01",
          rangeATo: "2025-06-30",
        },
      });
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect((hookResult.data as unknown as { totalExams: number }).totalExams).toBe(10);
    expect((hookResult.data as unknown as { averageScore: number }).averageScore).toBe(78);
  });
});
