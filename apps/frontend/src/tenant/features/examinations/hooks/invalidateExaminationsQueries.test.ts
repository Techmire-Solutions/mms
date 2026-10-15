import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateExaminationsQueries } from "./invalidateExaminationsQueries";
import {
  EXAMINATIONS_EXAMS_QUERY_KEY,
  EXAMINATIONS_METRICS_QUERY_KEY,
  EXAMINATIONS_RESULTS_QUERY_KEY,
} from "./useExaminationsApi";

describe("invalidateExaminationsQueries", () => {
  it("invalidates all examination query keys on queryClient", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateExaminationsQueries(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: EXAMINATIONS_EXAMS_QUERY_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: EXAMINATIONS_RESULTS_QUERY_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: EXAMINATIONS_METRICS_QUERY_KEY });
  });
});
