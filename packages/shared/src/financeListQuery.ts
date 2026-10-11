import type { Invoice, Payment } from "./financeModuleManifest.js";
import { LIST_PAGE_MAX_LIMIT } from "./apiSchemas.js";
import { paginateArray } from "./utils.js";

/** Query accepted by finance invoice and payment list endpoints. */
export interface FinanceListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean;
}

/** Paginated finance invoice response. */
export interface FinanceInvoicesListPageResult {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/** Paginated finance payment response. */
export interface FinancePaymentsListPageResult {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function sortRows<T>(rows: T[], query: FinanceListQuery): T[] {
  const sortField = query.sortField?.trim();
  if (!sortField) return rows;
  const direction = query.sortDir === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const leftValue = (left as Record<string, unknown>)[sortField];
    const rightValue = (right as Record<string, unknown>)[sortField];
    if (typeof leftValue === "number" || typeof rightValue === "number") {
      return (Number(leftValue ?? 0) - Number(rightValue ?? 0)) * direction;
    }
    return String(leftValue ?? "").localeCompare(String(rightValue ?? "")) * direction;
  });
}

/** Filters and paginates finance invoices. */
export function paginateFinanceInvoices(
  invoices: Invoice[],
  query: FinanceListQuery,
): FinanceInvoicesListPageResult {
  const search = query.search?.trim().toLowerCase();
  const filtered = search
    ? invoices.filter((invoice) =>
        [invoice.id, invoice.studentName, invoice.studentId, invoice.class, invoice.session].some(
          (value) => value.toLowerCase().includes(search),
        ),
      )
    : invoices;
  const result = paginateArray(
    sortRows(filtered, query),
    query.page ?? 1,
    query.limit ?? 10,
    LIST_PAGE_MAX_LIMIT,
  );
  return {
    invoices: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: result.hasMore,
  };
}

/** Filters and paginates finance payments. */
export function paginateFinancePayments(
  payments: Payment[],
  query: FinanceListQuery,
): FinancePaymentsListPageResult {
  const search = query.search?.trim().toLowerCase();
  const filtered = search
    ? payments.filter((payment) =>
        [
          payment.id,
          payment.invoiceId,
          payment.studentId,
          payment.studentName,
          payment.method,
          payment.note,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(search),
        ),
      )
    : payments;
  const result = paginateArray(
    sortRows(filtered, query),
    query.page ?? 1,
    query.limit ?? 10,
    LIST_PAGE_MAX_LIMIT,
  );
  return {
    payments: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: result.hasMore,
  };
}
