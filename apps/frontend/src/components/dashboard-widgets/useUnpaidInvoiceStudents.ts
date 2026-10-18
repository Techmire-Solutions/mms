import { isOpenInvoiceStatus, FINANCE_MODULE_MANIFEST } from "@mms/shared";
import { useFinanceInvoicesPaginated } from "@/tenant/hooks/collections/finance";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import { uniqueRegistryIds } from "@/lib/registryResolve";

/**
 * Shared finance-widget pipeline: load invoices, filter to open (unpaid)
 * invoices via the `isOpenInvoiceStatus` SSOT predicate, and hydrate the
 * referenced students into a lookup map. Consumed by the outstanding-fees
 * and overdue-obligations widgets.
 */
export function useUnpaidInvoiceStudents() {
  const invoices =
    useFinanceInvoicesPaginated({ page: 1, limit: FINANCE_MODULE_MANIFEST.maxPageSize }).data
      ?.invoices ?? [];
  const unpaidInvoices = (() =>
    invoices.filter((invoice) => isOpenInvoiceStatus(invoice.status)))();
  const studentIds = (() =>
    uniqueRegistryIds(unpaidInvoices.map((invoice) => invoice.studentId)))();
  const { data: students = [] } = useStudentsByIds(studentIds);
  const studentMap = (() => new Map(students.map((student) => [String(student.id), student])))();
  return { invoices, unpaidInvoices, students, studentMap };
}
