import {
  translateApp,
  type AccountingReportAggregates,
  type AccountingReportPdfBody,
  type AppTranslationKey,
  type TypstLedgerEntry,
  type TypstTrialBalancePayload,
  type TypstTrialBalanceSection,
} from "@mms/shared";
import { NotFoundError } from "../../lib/httpErrors.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { accountingReportDocumentsRepository as documents } from "../repository/accountingReportDocumentsAdapter.js";
import { getWorkspaceBySubdomain } from "../../services/workspaceService.js";
import { accountingUseCases } from "./accountingUseCases.js";

/**
 * Server-side payloads for the printable Accounting statements.
 *
 * Built from the same aggregates/ledger reads the UI uses, never from client input,
 * so a report PDF cannot show numbers the reports tier would not show. `lang` and
 * `direction` travel inside the document data, which is how the Typst templates
 * shape and lay out Arabic/Urdu/Farsi correctly.
 */

export interface AccountingPdfDocument {
  template: "trial-balance" | "financial-ledger";
  data: TypstTrialBalancePayload | Record<string, unknown>;
  filename: string;
  lang: "ar" | "ur" | "fa" | "en";
  direction: "rtl" | "ltr";
}

const SECTION_KEYS: Record<string, AppTranslationKey> = {
  Asset: "accounting.reports.assets",
  Liability: "accounting.reports.liabilities",
  Equity: "accounting.reports.equity",
  Revenue: "accounting.reports.revenue",
  Expense: "accounting.reports.expenses",
};

const SECTION_ORDER = ["Asset", "Liability", "Equity", "Revenue", "Expense"] as const;

const money = (centsOrAmount: number): string => (centsOrAmount ?? 0).toFixed(2);

function resolveDirection(body: AccountingReportPdfBody): {
  lang: "ar" | "ur" | "fa" | "en";
  direction: "rtl" | "ltr";
} {
  const lang = body.lang ?? "en";
  const direction = body.direction ?? (lang === "en" ? "ltr" : "rtl");
  return { lang, direction };
}

async function loadInstitution(tenant: string): Promise<string> {
  const workspace = await getWorkspaceBySubdomain(tenant);
  return workspace?.madrasaName?.trim() || "Madrasa Management System";
}

function periodLabel(dateFrom: string | undefined, dateTo: string | undefined): string {
  if (!dateFrom && !dateTo) return "";
  return [dateFrom ?? "", dateTo ?? ""].filter(Boolean).join(" – ");
}

/** Trial Balance PDF: one section per account type, with per-section and grand totals. */
export async function buildTrialBalanceDocument(
  body: AccountingReportPdfBody,
  aggregates: AccountingReportAggregates,
): Promise<AccountingPdfDocument> {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  const { lang, direction } = resolveDirection(body);
  const [institution, currency] = await Promise.all([
    loadInstitution(tenant),
    documents.getCurrencySettings(tenant).then((settings) => settings.functionalCurrency),
  ]);

  const sections: TypstTrialBalanceSection[] = [];
  let grandDebit = 0;
  let grandCredit = 0;
  for (const type of SECTION_ORDER) {
    const rows = aggregates.trialBalance.filter((row) => row.type === type);
    if (rows.length === 0) continue;
    const totalDebit = rows.reduce((total, row) => total + row.totalDebit, 0);
    const totalCredit = rows.reduce((total, row) => total + row.totalCredit, 0);
    grandDebit += totalDebit;
    grandCredit += totalCredit;
    sections.push({
      title: translateApp(SECTION_KEYS[type], lang),
      rows: rows.map((row) => ({
        code: row.code,
        name: row.name,
        debit: money(row.totalDebit),
        credit: money(row.totalCredit),
        balance: money(row.balance),
      })),
      totalDebit: money(totalDebit),
      totalCredit: money(totalCredit),
    });
  }

  return {
    template: "trial-balance",
    lang,
    direction,
    filename: `trial-balance-${body.dateTo ?? "all-time"}.pdf`,
    data: {
      institution,
      period: periodLabel(body.dateFrom, body.dateTo),
      currency,
      lang,
      direction,
      sections,
      totalDebit: money(grandDebit),
      totalCredit: money(grandCredit),
      preparedBy: "",
      generatedAt: new Date().toISOString().slice(0, 10),
    },
  };
}

/** General Ledger PDF (reuses `financial-ledger.typ`, already BiDi-aware). */
export async function buildGeneralLedgerDocument(
  body: AccountingReportPdfBody,
): Promise<AccountingPdfDocument> {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  if (!body.accountId) throw new NotFoundError("Account not found");
  const { lang, direction } = resolveDirection(body);
  const [institution, currency, document] = await Promise.all([
    loadInstitution(tenant),
    documents.getCurrencySettings(tenant).then((settings) => settings.functionalCurrency),
    documents.loadLedgerDocument(tenant, body.accountId, {
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    }),
  ]);
  if (!document) throw new NotFoundError("Account not found");
  if (document.truncated) {
    throw Object.assign(new Error("The ledger is too large for one PDF; narrow the date range"), {
      statusCode: 413,
      type: "payload_too_large",
    });
  }

  const entries: TypstLedgerEntry[] = document.lines.map((line) => ({
    date: line.date,
    accountCode: line.ref || document.account.code,
    description: line.description || line.lineDescription,
    debit: money(line.debitCents / 100),
    credit: money(line.creditCents / 100),
    balance: money((document.openingCents + line.runningCents) / 100),
  }));

  return {
    template: "financial-ledger",
    lang,
    direction,
    filename: `ledger-${document.account.code}-${body.dateTo ?? "all-time"}.pdf`,
    data: {
      institution,
      period: periodLabel(body.dateFrom, body.dateTo),
      currency,
      entries,
      totalDebit: money(document.movement.debitCents / 100),
      totalCredit: money(document.movement.creditCents / 100),
      netBalance: money(
        (document.openingCents + document.movement.debitCents - document.movement.creditCents) /
          100,
      ),
    },
  };
}

/** Resolves the printable document for a validated report-PDF request. */
export async function buildAccountingReportDocument(
  body: AccountingReportPdfBody,
): Promise<AccountingPdfDocument> {
  if (body.kind === "general-ledger") return buildGeneralLedgerDocument(body);
  const aggregates = await accountingUseCases.loadAccountingReportAggregates({
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
  });
  return buildTrialBalanceDocument(body, aggregates);
}
