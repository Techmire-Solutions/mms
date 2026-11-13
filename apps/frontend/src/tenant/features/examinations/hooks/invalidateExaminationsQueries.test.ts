import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateExaminationsQueries } from "./invalidateExaminationsQueries";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";
import {
  EXAMINATIONS_ELIGIBILITY_QUERY_KEY,
  EXAMINATIONS_EXAMS_QUERY_KEY,
  EXAMINATIONS_METRICS_QUERY_KEY,
  EXAMINATIONS_RESULTS_QUERY_KEY,
} from "./examinationsQueryKeys";
import { EXAMINATIONS_REPORT_AGGREGATES_QUERY_KEY } from "./examinationsQueryKeys";

describe("invalidateExaminationsQueries", () => {
  it("invalidates all examination query keys on queryClient", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateExaminationsQueries(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: EXAMINATIONS_EXAMS_QUERY_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: EXAMINATIONS_RESULTS_QUERY_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: EXAMINATIONS_METRICS_QUERY_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: EXAMINATIONS_REPORT_AGGREGATES_QUERY_KEY,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: EXAMINATIONS_ELIGIBILITY_QUERY_KEY,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY_ROOT });
  });
});
