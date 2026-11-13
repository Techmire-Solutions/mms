import {
  ACCOUNTING_ACCOUNT_TYPES,
  ACCOUNTING_MODULE_MANIFEST,
  accountingImportRowSchema,
  currencyCodeSchema,
  type Account,
} from "@mms/shared";
import { logger } from "../lib/logger.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";
import { saveStreamedExportArtifact } from "./exportArtifactService.js";
import { accountingUseCases } from "../accounting/use-cases/accountingUseCases.js";
import {
  accountingChartExportService,
  generateLedgerExportCsv,
  type AccountingLedgerExportQuery,
} from "./accountingExportService.js";
import { buildAccountingReportDocument } from "../accounting/use-cases/accountingReportPdfUseCases.js";
import { accountingReportPdfBodySchema } from "@mms/shared";

type AccountingImportRow = import("zod").infer<typeof accountingImportRowSchema>;

/**
 * Chart-of-Accounts CSV import (`accounting:import`).
 *
 * The registered `POST /api/accounting/import` route validates rows against
 * `accountingImportRowSchema` and enqueues them; before this runner existed the
 * route answered 503 because `hasBackgroundJobRunner("accounting:import")` was
 * false. Journal *entries* are deliberately not imported here: a flat CSV cannot
 * represent one balanced double-entry voucher, and the interactive bulk save is a
 * single `PUT /entries/bulk` transaction with the draft/post gate applied.
 *
 * Retry safety does not come from the BullMQ job id: it comes from resolving each
 * row's existing account **by code** and reusing its id, so a replayed job updates
 * the same rows instead of inserting a second chart. The active-code unique index
 * (migration 0253) is the database backstop if two jobs race.
 */

const CHUNK_SIZE = 100;
/** The bulk upsert ceiling; a larger chart is rejected rather than truncated. */
const MAX_IMPORT_ROWS = 2000;
const PAGE_SIZE = 500;

const ACCOUNT_TYPE_BY_LOWER = new Map(ACCOUNTING_ACCOUNT_TYPES.map((t) => [t.toLowerCase(), t]));

interface RowError {
  row: number;
  reason: string;
}

/** Normalizes the CSV `type` cell (`asset`, `ASSET`, `Asset` all map to `Asset`). */
function normalizeType(value: string): Account["type"] | null {
  return ACCOUNT_TYPE_BY_LOWER.get(value.trim().toLowerCase()) ?? null;
}

/** Resolves every active account's code → id so a re-import updates instead of duplicating. */
async function loadCodeIndex(): Promise<Map<string, string>> {
  const byCode = new Map<string, string>();
  for (let page = 1; page * PAGE_SIZE <= MAX_IMPORT_ROWS; page += 1) {
    const result = await accountingUseCases.loadAccountsPage({ page, limit: PAGE_SIZE });
    for (const account of result.accounts) {
      byCode.set(account.code.trim().toLowerCase(), account.id);
    }
    if (result.accounts.length < PAGE_SIZE) break;
  }
  return byCode;
}

/**
 * Maps one validated CSV row to a full `Account`.
 *
 * `balance` is ignored on purpose: opening balances are replaced through
 * `PUT /opening-balances/:fiscalYearId`, which posts the balanced opening journal;
 * writing a bare number onto the account row would create a non-ledger balance.
 */
function toAccount(
  row: AccountingImportRow,
  rowNumber: number,
  byCode: Map<string, string>,
  seenInFile: Set<string>,
): { account: Account } | { error: RowError } {
  const code = row.code?.trim() ?? "";
  const name = row.name?.trim() ?? "";
  if (!code) return { error: { row: rowNumber, reason: "code is required" } };
  if (!name) return { error: { row: rowNumber, reason: "name is required" } };
  const key = code.toLowerCase();
  if (seenInFile.has(key)) {
    return { error: { row: rowNumber, reason: `duplicate code ${code} in this file` } };
  }
  const type = row.type ? normalizeType(row.type) : null;
  if (!type) {
    return {
      error: {
        row: rowNumber,
        reason: `type must be one of ${ACCOUNTING_ACCOUNT_TYPES.join(", ")}`,
      },
    };
  }
  const active = (row.status ?? "").trim().toLowerCase();
  const isActive = active === "" || !["inactive", "archived", "disabled"].includes(active);
  // `currency` is `varchar(3)` and the write path re-validates with
  // `currencyCodeSchema`; an unchecked 2- or 4-letter value failed the whole batch
  // inside `upsertAccounts` with no row number, reporting zero imports.
  const currency = row.currency?.trim().toUpperCase() || null;
  if (currency !== null && !currencyCodeSchema.safeParse(currency).success) {
    return {
      error: {
        row: rowNumber,
        reason: "currency must be a 3-letter ISO currency code",
      },
    };
  }
  const existingId = byCode.get(key);
  return {
    account: {
      id: existingId ?? `acc-csv-${crypto.randomUUID()}`,
      code,
      name,
      type,
      subtype: row.category?.trim() ?? "",
      description: row.description?.trim() ?? "",
      isActive,
      accountCurrency: currency,
    },
  };
}

/** The `accounting:import` runner body; exported for the unit suite. */
export async function importAccountingAccounts(
  rows: unknown[],
  ctx: {
    tenant: string;
    userId: string;
    signal?: AbortSignal;
    updateProgress: (current: number, total: number) => Promise<void>;
  },
): Promise<{ imported: number; failed: number; total: number; errors: RowError[] }> {
  const total = rows.length;
  if (total > MAX_IMPORT_ROWS) {
    throw new Error(`A chart import is limited to ${MAX_IMPORT_ROWS} rows (received ${total})`);
  }

  const byCode = await loadCodeIndex();
  const seenInFile = new Set<string>();
  const errors: RowError[] = [];
  const accounts: Account[] = [];

  rows.forEach((raw, index) => {
    const parsed = accountingImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({
        row: index + 1,
        reason: parsed.error.issues[0]?.message ?? "invalid row",
      });
      return;
    }
    const mapped = toAccount(parsed.data, index + 1, byCode, seenInFile);
    if ("error" in mapped) {
      errors.push(mapped.error);
      return;
    }
    seenInFile.add(mapped.account.code.toLowerCase());
    accounts.push(mapped.account);
  });

  let imported = 0;
  for (let offset = 0; offset < accounts.length; offset += CHUNK_SIZE) {
    throwIfBackgroundJobAborted(ctx.signal);
    const chunk = accounts.slice(offset, offset + CHUNK_SIZE);
    // The upsert is idempotent by id: a replayed job reuses the id resolved from the
    // stored code, so the second run updates the same chart rows.
    await accountingUseCases.upsertAccounts(chunk);
    imported += chunk.length;
    await ctx.updateProgress(imported, Math.max(total, 1));
  }

  logger.info(
    { tenant: ctx.tenant, total, imported, failed: errors.length },
    "Chart-of-Accounts CSV import finished",
  );
  return { imported, failed: errors.length, total, errors };
}

/** Registers the accounting module's queued import/export/PDF runners. */
export function registerAccountingBackgroundJobRunners(): void {
  const moduleId = ACCOUNTING_MODULE_MANIFEST.moduleId;

  registerModuleCsvImportJobRunner<AccountingImportRow>({
    moduleId,
    entityNounPlural: "accounts",
    importBatch: (rows, ctx) =>
      importAccountingAccounts(rows, {
        tenant: ctx.tenant,
        userId: ctx.userId,
        signal: ctx.signal,
        updateProgress: ctx.updateProgress,
      }),
  });

  // Chart-of-Accounts CSV export — the registered POST /api/accounting/export
  // route used to answer 503 because this runner did not exist.
  registerModuleCsvExportJobRunner({
    moduleId,
    entityNounPlural: "accounts",
    buildExport: (query, options) =>
      accountingChartExportService.buildExport(query, {
        columns: options.columns as never,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted,
      }),
    generateStreamChunks: (query, options) =>
      accountingChartExportService.streamExport(query, {
        columns: options.columns as never,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted,
      }) as never,
  });

  // Full journal-register export: keyset pages streamed to storage, so a large
  // ledger no longer depends on the browser having loaded it.
  registerModuleCsvExportJobRunner({
    moduleId,
    kind: "export-ledger",
    entityNounPlural: "ledger lines",
    buildExport: async () => {
      throw new Error("The ledger export is stream-only");
    },
    generateStreamChunks: (query, options, tenant) =>
      generateLedgerExportCsv(tenant ?? "", query as unknown as AccountingLedgerExportQuery, {
        filename: options.filename ?? "ledger.csv",
      }),
  });

  // Printable statement PDFs (Trial Balance / General Ledger) through the BiDi
  // Typst engine; the kind contains "pdf", so it lands on the sandboxed PDF queue.
  registerBackgroundJobRunner(`${moduleId}:report-pdf`, async (payload, ctx) => {
    const body = accountingReportPdfBodySchema.parse(payload);
    throwIfBackgroundJobAborted(ctx.signal);
    const document = await buildAccountingReportDocument(body);
    throwIfBackgroundJobAborted(ctx.signal);
    const { processPdfRenderJob } = await import("../worker/processors/pdf-rendering.js");
    const result = await processPdfRenderJob(
      ctx.tenant,
      {
        template: document.template,
        data: document.data as Record<string, unknown>,
        filename: document.filename,
        lang: document.lang,
        direction: document.direction,
      },
      async (percent) => ctx.updateProgress(percent, 100),
      ctx.signal,
    );
    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename: document.filename,
      contentType: "application/pdf",
    });
    await ctx.complete({
      label: `Generated ${body.kind} PDF`,
      progress: { current: 100, total: 100 },
      hasDownload: true,
    });
  });
}
