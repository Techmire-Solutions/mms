import type {
  AccountingLedgerPage,
  AccountingLedgerQuery,
  ReceivablesAging,
  ReceivablesAgingQuery,
} from "@mms/shared";
import { LIST_PAGE_MAX_LIMIT } from "@mms/shared";
import { NotFoundError } from "../../lib/httpErrors.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { accountingReportEndpointsRepository } from "../repository/accountingReportEndpointsRepository.js";

const DEFAULT_PAGE_SIZE = 100;
/** One page of AR aging rows; totals always cover every open invoice. */
const AGING_PAGE_SIZE = 500;

/** Converts an integer amount of cents to the two-decimal number the DTOs carry. */
function centsToAmount(cents: number): number {
  return cents / 100;
}

function requireTenant(): string {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  return tenant;
}

/**
 * One page of the General Ledger for a single account: the opening balance carried
 * from before the window, the page's lines with an exact running balance and the
 * window's totals. Computing this in the browser silently stopped at 5,000 entries.
 */
export async function loadAccountLedger(
  query: AccountingLedgerQuery,
): Promise<AccountingLedgerPage> {
  const tenant = requireTenant();
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, LIST_PAGE_MAX_LIMIT);

  const account = await accountingReportEndpointsRepository.findLedgerAccount(
    tenant,
    query.accountId,
  );
  if (!account) throw new NotFoundError("Account not found");

  const [openingCents, movement, pageResult] = await Promise.all([
    accountingReportEndpointsRepository.sumLedgerOpeningCents(tenant, account.id, query.dateFrom),
    accountingReportEndpointsRepository.sumLedgerMovementCents(
      tenant,
      account.id,
      query.dateFrom,
      query.dateTo,
    ),
    accountingReportEndpointsRepository.listLedgerLinesPage(tenant, account.id, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      offset: (page - 1) * limit,
      limit,
    }),
  ]);

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type as AccountingLedgerPage["account"]["type"],
      subtype: account.subtype,
    },
    openingBalance: centsToAmount(openingCents),
    lines: pageResult.lines.map((line) => ({
      id: line.id,
      entryId: line.entryId,
      date: line.date,
      ref: line.ref,
      description: line.description,
      lineDescription: line.lineDescription,
      debit: centsToAmount(line.debitCents),
      credit: centsToAmount(line.creditCents),
      // The SQL window accumulates from the window start; the ledger's running
      // balance starts from the opening balance carried in from before it.
      running: centsToAmount(openingCents + line.runningCents),
    })),
    totalDebit: centsToAmount(movement.debitCents),
    totalCredit: centsToAmount(movement.creditCents),
    closingBalance: centsToAmount(openingCents + movement.debitCents - movement.creditCents),
    page,
    limit,
    total: pageResult.total,
    hasMore: page * limit < pageResult.total,
  };
}

/**
 * Receivables aging as of a date, grouped per student. Buckets are days past due;
 * an invoice due on/after the as-of date is "current". Open invoices only, using
 * their stored balances so a later late fee cannot rewrite an earlier report.
 */
export async function loadReceivablesAging(
  query: ReceivablesAgingQuery,
): Promise<ReceivablesAging> {
  const tenant = requireTenant();
  const { rows, totals } = await accountingReportEndpointsRepository.listReceivablesAging(
    tenant,
    query.asOf,
    AGING_PAGE_SIZE,
  );
  const visible = rows.slice(0, AGING_PAGE_SIZE);
  return {
    asOf: query.asOf,
    rows: visible.map((row) => ({
      studentId: row.studentId,
      studentName: row.studentName,
      className: row.className,
      sessionName: row.sessionName,
      invoiceCount: row.invoiceCount,
      current: centsToAmount(row.currentCents),
      d1_30: centsToAmount(row.d1_30Cents),
      d31_60: centsToAmount(row.d31_60Cents),
      d61_90: centsToAmount(row.d61_90Cents),
      d90_plus: centsToAmount(row.d90PlusCents),
      total: centsToAmount(row.totalCents),
    })),
    totals: {
      current: centsToAmount(totals.currentCents),
      d1_30: centsToAmount(totals.d1_30Cents),
      d31_60: centsToAmount(totals.d31_60Cents),
      d61_90: centsToAmount(totals.d61_90Cents),
      d90_plus: centsToAmount(totals.d90PlusCents),
      total: centsToAmount(totals.totalCents),
      invoiceCount: totals.invoiceCount,
    },
    totalStudents: totals.totalStudents,
    hasMore: rows.length > AGING_PAGE_SIZE,
  };
}
