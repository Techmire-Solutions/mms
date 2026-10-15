import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateEnrollmentsQueries } from "./invalidateEnrollmentsQueries";

describe("invalidateEnrollmentsQueries", () => {
  it("calls invalidateQueries on queryClient for all enrollments keys", () => {
    const mockQueryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient;

    invalidateEnrollmentsQueries(mockQueryClient);

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(4);
  });
});
