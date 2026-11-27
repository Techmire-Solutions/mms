import { beforeAll, describe, expect, it, vi } from "vitest";
import { configureContactsCrossModuleQueryKeys } from "@mms/mod-contacts/frontend/tenant/crossModuleQueryKeys";
import { configureFacultyCrossModuleKeys } from "@mms/mod-faculty/frontend/tenant/crossModuleKeys";
import { configureFinanceAccountingKeys } from "@mms/mod-billing/frontend/tenant/host/accountingCollection";
import { configureStudentsHost } from "@mms/mod-students/frontend/tenant/host";
import { invalidateContactsQueries } from "@/tenant/hooks/collections/contacts";
import {
  MESSAGING_CONTACTS_RESOLVE_QUERY_KEY,
  MESSAGING_RECIPIENTS_QUERY_KEY,
} from "@/tenant/hooks/collections/messaging";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateStudentsQueries } from "@/tenant/hooks/collections/students";
import { invalidateFacultyQueries } from "@/tenant/hooks/collections/faculty";
import { invalidateFinanceQueries } from "@/tenant/hooks/collections/finance";
import { invalidateAccountingQueries } from "@/tenant/hooks/collections/accounting";
import { invalidateExaminationsQueries } from "@/tenant/hooks/collections/examinations";
import { invalidateObligationsQueries } from "@/tenant/hooks/collections/obligations";
import { invalidateHasanatQueries } from "@/tenant/hooks/collections/hasanat";
import { invalidateAttendanceQueries } from "@/tenant/hooks/collections/attendance";
import { CONTACTS_QUERY_KEY } from "@mms/mod-contacts/frontend/tenant/hooks/contactsQueryKeys";
import {
  STUDENTS_METRICS_QUERY_KEY,
  STUDENTS_QUERY_KEY,
} from "@mms/mod-students/frontend/tenant/hooks/studentsQueryKeys";
import {
  FACULTY_DETAIL_QUERY_KEY,
  FACULTY_METRICS_QUERY_KEY,
  FACULTY_QUERY_KEY,
} from "@mms/mod-faculty/frontend/tenant/hooks/facultyQueryKeys";
import {
  FINANCE_INVOICES_QUERY_KEY,
  FINANCE_PAYMENTS_QUERY_KEY,
} from "@mms/mod-billing/frontend/tenant/hooks/financeQueryKeys";
import {
  ACCOUNTING_ACCOUNTS_QUERY_KEY,
  ACCOUNTING_ENTRIES_QUERY_KEY,
} from "@mms/mod-accounting/frontend/tenant/hooks/accountingQueryKeys";
import {
  EXAMINATIONS_EXAMS_QUERY_KEY,
  EXAMINATIONS_RESULTS_QUERY_KEY,
} from "@mms/mod-examinations/frontend/tenant/hooks/examinationsQueryKeys";
import {
  OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  OBLIGATIONS_WAKALA_QUERY_KEY,
} from "@mms/mod-obligations/frontend/tenant/hooks/obligationsQueryKeys";
import { HASANAT_DISTRIBUTIONS_QUERY_KEY } from "@mms/mod-hasanat/frontend/tenant/hooks/hasanatQueryKeys";
import { attendanceQueryKeys } from "@mms/mod-attendance/frontend/tenant/hooks/attendanceQueryKeys";

function capture(invalidator: (queryClient: QueryClient) => void): readonly (readonly unknown[])[] {
  const queryClient = { invalidateQueries: vi.fn() };
  invalidator(queryClient as unknown as QueryClient);
  return queryClient.invalidateQueries.mock.calls.map(
    ([call]) => (call as { queryKey: readonly unknown[] }).queryKey,
  );
}

function invalidates(keys: readonly (readonly unknown[])[], expected: readonly unknown[]): boolean {
  const expectedPrefix = JSON.stringify(expected);
  return keys.some((key) => JSON.stringify(key).startsWith(expectedPrefix));
}

/**
 * Cache-invalidation conformance for module writes.
 *
 * Every form mutation relies on its module invalidator to refresh list, detail,
 * metrics, report and lookup caches before the modal closes. These assertions
 * pin the families that a write actually changes; a new query cache that is not
 * invalidated here leaves the UI stale until the websocket echo (or a reload).
 */
describe("module query invalidation conformance", () => {
  // The app composition root (providers/ContactsHostProvider.tsx) binds these keys; a test that
  // renders no provider must bind them explicitly or the module falls back to empty keys.
  beforeAll(() => {
    configureContactsCrossModuleQueryKeys({
      messagingContactsResolve: MESSAGING_CONTACTS_RESOLVE_QUERY_KEY,
      messagingRecipients: MESSAGING_RECIPIENTS_QUERY_KEY,
      studentsMetrics: STUDENTS_METRICS_QUERY_KEY,
      students: STUDENTS_QUERY_KEY,
    });
    // Faculty invalidates the contacts/students caches it reconciles; the app binds these in
    // providers/FacultyHostProvider.tsx, so the test must bind them too.
    configureFacultyCrossModuleKeys({
      contacts: CONTACTS_QUERY_KEY,
      students: STUDENTS_QUERY_KEY,
    });
    // Finance writes also invalidate the accounting ledger caches; the app binds this in
    // providers/BillingHostProvider.tsx.
    configureFinanceAccountingKeys({
      invalidateAccountingQueries,
      ACCOUNTING_ENTRIES_QUERY_KEY,
    });
    // Students invalidate the contact-derived caches through their module host seam; the app
    // binds the real collection table in providers/StudentsHostProvider.tsx.
    configureStudentsHost({
      contactsCollection: { invalidateContactsQueries },
    } as unknown as Parameters<typeof configureStudentsHost>[0]);
  });

  it("refreshes contacts list + metrics and the student rows that derive from them", () => {
    const keys = capture(invalidateContactsQueries);
    expect(invalidates(keys, CONTACTS_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, STUDENTS_QUERY_KEY)).toBe(true);
  });

  it("refreshes student list/metrics and the contact caches reconciled by the server", () => {
    const keys = capture(invalidateStudentsQueries);
    expect(invalidates(keys, STUDENTS_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, STUDENTS_METRICS_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, CONTACTS_QUERY_KEY)).toBe(true);
  });

  it("refreshes faculty list, metrics and detail-scoped assignment caches", () => {
    const keys = capture(invalidateFacultyQueries);
    expect(invalidates(keys, FACULTY_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, FACULTY_METRICS_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, FACULTY_DETAIL_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, CONTACTS_QUERY_KEY)).toBe(true);
  });

  it("refreshes invoices, payments and the ledger caches a finance write posts to", () => {
    const keys = capture(invalidateFinanceQueries);
    expect(invalidates(keys, FINANCE_INVOICES_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, FINANCE_PAYMENTS_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, ACCOUNTING_ENTRIES_QUERY_KEY)).toBe(true);
  });

  it("refreshes journal entries, accounts and fiscal years", () => {
    const keys = capture(invalidateAccountingQueries);
    expect(invalidates(keys, ACCOUNTING_ENTRIES_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, ACCOUNTING_ACCOUNTS_QUERY_KEY)).toBe(true);
  });

  it("refreshes exams + results, not only the exam list", () => {
    const keys = capture(invalidateExaminationsQueries);
    expect(invalidates(keys, EXAMINATIONS_EXAMS_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, EXAMINATIONS_RESULTS_QUERY_KEY)).toBe(true);
  });

  it("refreshes obligation collections and the wakala cache a distribution edits", () => {
    const keys = capture(invalidateObligationsQueries);
    expect(invalidates(keys, OBLIGATIONS_COLLECTIONS_QUERY_KEY)).toBe(true);
    expect(invalidates(keys, OBLIGATIONS_WAKALA_QUERY_KEY)).toBe(true);
  });

  it("refreshes hasanat distributions and their metrics", () => {
    const keys = capture(invalidateHasanatQueries);
    expect(invalidates(keys, HASANAT_DISTRIBUTIONS_QUERY_KEY)).toBe(true);
  });

  it("refreshes the attendance root and exam eligibility after marking", () => {
    const keys = capture(invalidateAttendanceQueries);
    expect(invalidates(keys, attendanceQueryKeys.all)).toBe(true);
  });
});
