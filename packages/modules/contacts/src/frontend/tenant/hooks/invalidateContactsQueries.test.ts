import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { configureContactsCrossModuleQueryKeys } from "@mms/mod-contacts/frontend/tenant/crossModuleQueryKeys";

const STUDENTS_QUERY_KEY = ["students"];
const STUDENTS_METRICS_QUERY_KEY = ["students", "metrics"];

configureContactsCrossModuleQueryKeys({
  messagingContactsResolve: ["messaging", "contacts", "resolve"],
  messagingRecipients: ["messaging", "recipients"],
  studentsMetrics: STUDENTS_METRICS_QUERY_KEY,
  students: STUDENTS_QUERY_KEY,
});
import { invalidateContactsQueries } from "./invalidateContactsQueries.js";

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

  it("can skip the student echo when the caller already invalidated them", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateContactsQueries(queryClient, { includeStudents: false });

    const keys = invalidateQueries.mock.calls.map(([arg]) =>
      JSON.stringify((arg as { queryKey?: unknown }).queryKey),
    );
    expect(keys).not.toContain(JSON.stringify(STUDENTS_QUERY_KEY));
    expect(keys).not.toContain(JSON.stringify(STUDENTS_METRICS_QUERY_KEY));
  });
});
