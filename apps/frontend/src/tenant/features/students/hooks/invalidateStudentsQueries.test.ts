import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { CONTACTS_QUERY_KEY } from "@/tenant/hooks/collections/contacts";
import { ENROLLMENTS_QUERY_KEY } from "@/tenant/hooks/collections/enrollments";
import { SESSIONS_QUERY_KEY } from "@/tenant/hooks/collections/sessions";
import {
  invalidateStudentsBulkEnrollQueries,
  invalidateStudentsQueries,
} from "@/tenant/features/students/hooks/invalidateStudentsQueries";
import { STUDENTS_QUERY_KEY } from "@/tenant/features/students/hooks/studentsQueryKeys";

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

describe("invalidateStudentsQueries", () => {
  it("invalidates the contact-derived caches reconciled by every student write", () => {
    const { client, keys } = spyOnInvalidateQueries();

    invalidateStudentsQueries(client);

    expect(keys()).toContainEqual(STUDENTS_QUERY_KEY);
    expect(keys()).toContainEqual(CONTACTS_QUERY_KEY);
  });
});

describe("invalidateStudentsBulkEnrollQueries", () => {
  it("invalidates students, sessions and enrollments", () => {
    const { client, keys } = spyOnInvalidateQueries();

    invalidateStudentsBulkEnrollQueries(client);

    expect(keys()).toContainEqual(STUDENTS_QUERY_KEY);
    expect(keys()).toContainEqual(SESSIONS_QUERY_KEY);
    expect(keys()).toContainEqual(ENROLLMENTS_QUERY_KEY);
  });
});
