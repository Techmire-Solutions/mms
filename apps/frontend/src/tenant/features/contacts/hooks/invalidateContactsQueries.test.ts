import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  STUDENTS_METRICS_QUERY_KEY,
  STUDENTS_QUERY_KEY,
} from "@/tenant/hooks/collections/students";
import { invalidateContactsQueries } from "./invalidateContactsQueries";

describe("invalidateContactsQueries", () => {
  it("also invalidates the student keys derived from contact records", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateContactsQueries(queryClient);

    const keys = invalidateQueries.mock.calls.map(([arg]) =>
      JSON.stringify((arg as { queryKey?: unknown }).queryKey),
    );
    expect(keys).toContain(JSON.stringify(STUDENTS_QUERY_KEY));
    expect(keys).toContain(JSON.stringify(STUDENTS_METRICS_QUERY_KEY));
  });
});
