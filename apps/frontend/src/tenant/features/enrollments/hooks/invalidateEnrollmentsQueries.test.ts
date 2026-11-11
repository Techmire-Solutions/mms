import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateEnrollmentsQueries } from "./invalidateEnrollmentsQueries";
import { EXAMINATIONS_ELIGIBILITY_QUERY_KEY } from "@/tenant/hooks/collections/examinations";

describe("invalidateEnrollmentsQueries", () => {
  it("calls invalidateQueries on queryClient for all enrollments keys", () => {
    const mockQueryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient;

    invalidateEnrollmentsQueries(mockQueryClient);
    const mockedCalls = () =>
      (mockQueryClient.invalidateQueries as ReturnType<typeof vi.fn>).mock.calls.map(
        (call) => (call[0] as { queryKey: unknown[] }).queryKey,
      );

    const keys = mockedCalls();
    expect(keys).toEqual(
      expect.arrayContaining([
        ["enrollments", "list"],
        ["enrollments", "metrics"],
        ["enrollments", "widget-aggregates"],
        ["enrollments", "report-aggregates"],
        ["enrollments", "placements"],
        ["enrollments", "admissions"],
        EXAMINATIONS_ELIGIBILITY_QUERY_KEY,
      ]),
    );
  });
});
