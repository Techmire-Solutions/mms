import { asc, desc, eq, ilike, isNotNull, isNull, or, type AnyColumn, type SQL } from "drizzle-orm";
import { isQueryFlagTrue, toSqlSearchPattern, type FinanceListQuery } from "@mms/shared";
import { financeInvoices, financePayments } from "../schema.js";

/**
 * WHERE/ORDER BY builders for the Finance invoice/payment list pages. Split out of
 * `financeRepositoryList.ts` for the ADR-001 line bands; only that module consumes
 * them, so no public surface changes.
 */

export function buildInvoiceListConditions(subdomain: string, query: FinanceListQuery): SQL[] {
  const conditions: SQL[] = [eq(financeInvoices.workspaceSubdomain, subdomain)];

  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(financeInvoices.deletedAt));
  } else {
    conditions.push(isNull(financeInvoices.deletedAt));
  }

  const search = query.search?.trim();
  if (search) {
    const searchPattern = toSqlSearchPattern(search);
    conditions.push(
      or(
        ilike(financeInvoices.id, searchPattern),
        ilike(financeInvoices.invoiceNumber, searchPattern),
        ilike(financeInvoices.studentName, searchPattern),
        ilike(financeInvoices.class, searchPattern),
        ilike(financeInvoices.session, searchPattern),
      ) as SQL,
    );
  }

  return conditions;
}

export function buildPaymentListConditions(subdomain: string, query: FinanceListQuery): SQL[] {
  const conditions: SQL[] = [eq(financePayments.workspaceSubdomain, subdomain)];

  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(financePayments.deletedAt));
  } else {
    conditions.push(isNull(financePayments.deletedAt));
  }

  const search = query.search?.trim();
  if (search) {
    const searchPattern = toSqlSearchPattern(search);
    conditions.push(
      or(
        ilike(financePayments.id, searchPattern),
        ilike(financePayments.invoiceId, searchPattern),
        ilike(financePayments.studentName, searchPattern),
        ilike(financePayments.method, searchPattern),
      ) as SQL,
    );
  }

  return conditions;
}

export function buildInvoiceOrderBy(sortField?: string, sortDir?: "asc" | "desc" | ""): SQL {
  const field = sortField?.trim() || "createdAt";
  let column: AnyColumn;
  switch (field) {
    case "createdAt":
      column = financeInvoices.createdAt;
      break;
    case "id":
      column = financeInvoices.id;
      break;
    case "studentName":
      column = financeInvoices.studentName;
      break;
    case "class":
      column = financeInvoices.class;
      break;
    case "session":
      column = financeInvoices.session;
      break;
    case "totalAmount":
      column = financeInvoices.finalAmt;
      break;
    case "status":
      column = financeInvoices.status;
      break;
    default:
      column = financeInvoices.createdAt;
  }
  return sortDir === "asc" ? asc(column) : desc(column);
}

export function buildPaymentOrderBy(sortField?: string, sortDir?: "asc" | "desc" | ""): SQL {
  const field = sortField?.trim() || "createdAt";
  let column: AnyColumn;
  switch (field) {
    case "createdAt":
      column = financePayments.createdAt;
      break;
    case "id":
      column = financePayments.id;
      break;
    case "invoiceId":
      column = financePayments.invoiceId;
      break;
    case "studentName":
      column = financePayments.studentName;
      break;
    case "method":
      column = financePayments.method;
      break;
    case "amount":
      column = financePayments.amount;
      break;
    default:
      column = financePayments.createdAt;
  }
  return sortDir === "asc" ? asc(column) : desc(column);
}
