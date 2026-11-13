import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { CONTACTS_QUERY_KEY } from "@/tenant/hooks/collections/contacts";
import { STUDENTS_QUERY_KEY } from "@/tenant/hooks/collections/students";
import { invalidateFacultyQueries } from "@/tenant/features/faculty/hooks/invalidateFacultyQueries";
import { FACULTY_QUERY_KEY } from "@/tenant/features/faculty/hooks/facultyQueryKeys";

function spyOnInvalidateQueries(): {
  client: QueryClient;
  keys: () => ReadonlyArray<readonly unknown[]>;
} {
  const client = new QueryClient();
  const spy = vi.spyOn(client, "invalidateQueries");
  return {
    client,
    keys: () =>
      spy.mock.calls
        .map(([filters]) => filters?.queryKey)
        .filter((key): key is readonly unknown[] => Array.isArray(key)),
  };
}

describe("invalidateFacultyQueries", () => {
  it("invalidates the contact-derived caches reconciled by every faculty write without cascading into students", () => {
    // `facultyWriteUseCases` calls `reconcileContactSystemTags`, so the Contacts
    // directory/detail projections go stale unless the owning collection is
    // invalidated alongside the faculty keys (same contract as Students).
    // Invalidation must NOT cascade into unrelated collections like Students.
    const { client, keys } = spyOnInvalidateQueries();

    invalidateFacultyQueries(client);

    expect(keys()).toContainEqual(FACULTY_QUERY_KEY);
    expect(keys()).toContainEqual(CONTACTS_QUERY_KEY);
    expect(keys()).not.toContainEqual(STUDENTS_QUERY_KEY);
  });
});
