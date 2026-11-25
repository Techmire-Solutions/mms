import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { STUDENTS_QUERY_KEY } from "@/tenant/features/students/hooks/studentsQueryKeys";

const mockInvalidateContacts = vi.fn();

vi.mock("@/tenant/hooks/collections/contacts", () => ({
  invalidateContactsQueries: (...args: unknown[]) => mockInvalidateContacts(...args),
}));

import { invalidateStudentsQueries } from "./invalidateStudentsQueries";

describe("invalidateStudentsQueries", () => {
  it("invalidates the student list once and suppresses the contacts echo", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateStudentsQueries(queryClient);

    const studentListCalls = invalidateQueries.mock.calls.filter(
      ([arg]) =>
        JSON.stringify((arg as { queryKey?: unknown }).queryKey) ===
        JSON.stringify(STUDENTS_QUERY_KEY),
    );
    expect(studentListCalls).toHaveLength(1);
    expect(mockInvalidateContacts).toHaveBeenCalledWith(queryClient, { includeStudents: false });
  });
});
