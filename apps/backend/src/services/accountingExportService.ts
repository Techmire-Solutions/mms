import {
  accountingTransferSchema,
  buildCsvContent,
  type Account,
  type AccountingTransferEntity,
} from "@mms/shared";
import { generateCsvStreamChunks } from "../lib/csvExportStreamFactory.js";
import { createModuleExportService } from "../lib/createModuleExportService.js";
import { accountingUseCases } from "../accounting/use-cases/accountingUseCases.js";
import {
  accountingReportDocumentsRepository,
  type LedgerExportRow,
} from "../accounting/repository/accountingReportDocumentsAdapter.js";

/**
 * Server-side Accounting exports.
 *
 * The COA export mirrors the CSV import (`accounting:import`) and uses the transfer
 * schema as its column SSOT, so a re-import of the exported file round-trips. It
 * goes through `createModuleExportService`: CSV is streamed with backpressure and
 * `escapeCsvCell` formula protection, XLSX/JSON stay under the 10 000-row cap.
 *
 * The ledger export pages one account's journal register with a keyset cursor, so a
 * large ledger leaves the server in bounded chunks instead of the browser holding it.
 */

const PAGE_SIZE = 250;
const ACCOUNT_EXPORT_MAX = 2000;

export interface AccountingLedgerExportQuery {
  accountId: string;
  dateFrom?: string;
  dateTo?: string;
}

/** The transfer shape the SSOT columns extract from. */
function accountToTransferEntity(account: Account): AccountingTransferEntity {
  return {
    code: account.code,
    name: account.name,
    type: account.type,
    category: account.subtype,
    currency: account.accountCurrency ?? "",
    balance: "",
    status: account.isActive ? "active" : "inactive",
    description: account.description,
  };
}

/** Emits the header, then one escaped CSV row per entity in bounded batches. */
function csvChunks<T>(
  entities: readonly T[],
  columns: readonly { id: string; label: string }[],
  extract: (entity: T, columnId: string) => unknown,
  chunkSize: number,
): Generator<string, void, undefined> {
  return (function* () {
    yield buildCsvContent([columns.map((column) => column.label)]);
    const batchSize = Math.min(Math.max(1, chunkSize), PAGE_SIZE);
    for (let start = 0; start < entities.length; start += batchSize) {
      const batch = entities.slice(start, start + batchSize);
      yield (
        buildCsvContent(
          batch.map((entity) => columns.map((column) => extract(entity, column.id))),
        ) + "\n"
      );
    }
  })();
}

const COA_COLUMNS = accountingTransferSchema.fields.map((field) => ({
  id: field.key,
  label: field.label,
}));

const coaExtract = (
  account: Account,
  columnId: string,
): string | number | boolean | null | undefined => {
  const entity = accountToTransferEntity(account);
  const field = accountingTransferSchema.fields.find((candidate) => candidate.key === columnId);
  return field?.extract ? field.extract(entity) : "";
};

/** Chart-of-Accounts export (`accounting:export`). */
export const accountingChartExportService = createModuleExportService<
  Account,
  { page?: number },
  { id: string; label: string }
>({
  manifest: { defaultExportFilename: "chart-of-accounts.csv", exportChunkSize: PAGE_SIZE },
  normalizeQuery: (query) => query,
  prepareExport: () => ({
    columns: COA_COLUMNS.map((column) => ({ id: column.id, label: column.label })),
    context: undefined,
  }),
  loadByIds: async (ids) => {
    // The COA is bounded; one pass is cheaper than an id-by-id lookup.
    const wanted = new Set(ids);
    const found: Account[] = [];
    for (let page = 1; page * PAGE_SIZE <= ACCOUNT_EXPORT_MAX; page += 1) {
      const result = await accountingUseCases.loadAccountsPage({ page, limit: PAGE_SIZE });
      found.push(...result.accounts.filter((account) => wanted.has(account.id)));
      if (result.accounts.length < PAGE_SIZE) break;
    }
    return found;
  },
  loadPage: async (_query, page, limit) => {
    const result = await accountingUseCases.loadAccountsPage({ page, limit });
    return {
      rows: result.accounts,
      hasMore: page * limit < result.total,
      nextCursor: result.accounts.at(-1)?.code,
    };
  },
  yieldDataChunks: (rows, columns, chunkSize) => csvChunks(rows, columns, coaExtract, chunkSize),
  extractCell: coaExtract,
});

const LEDGER_COLUMNS = [
  { id: "date", label: "Date" },
  { id: "ref", label: "Reference" },
  { id: "description", label: "Description" },
  { id: "lineNote", label: "Line note" },
  { id: "debit", label: "Debit" },
  { id: "credit", label: "Credit" },
] as const;

const ledgerExtract = (row: LedgerExportRow, columnId: string): unknown =>
  row[columnId as keyof LedgerExportRow];

/** Streamed journal-register export (`accounting:export-ledger`). */
export function generateLedgerExportCsv(
  tenant: string,
  query: AccountingLedgerExportQuery,
  options: { filename: string; chunkSize?: number },
): AsyncGenerator<string, { count: number; filename: string }, undefined> {
  return generateCsvStreamChunks<LedgerExportRow, { id: string; label: string }>({
    filename: options.filename,
    chunkSize: options.chunkSize ?? PAGE_SIZE,
    columns: LEDGER_COLUMNS.map((column) => ({ id: column.id, label: column.label })),
    loadByIds: async () => [],
    loadPage: async (_page, limit, afterId) => {
      const after = afterId
        ? (() => {
            const [date, entryId, lineId] = afterId.split("|");
            return { date, entryId, lineId };
          })()
        : undefined;
      const result = await accountingReportDocumentsRepository.listLedgerExportRows(
        tenant,
        query.accountId,
        { dateFrom: query.dateFrom, dateTo: query.dateTo },
        after,
        limit,
      );
      return { rows: result.rows, hasMore: result.hasMore, nextCursor: result.nextCursor };
    },
    yieldDataChunks: (rows, columns, chunkSize) =>
      csvChunks(rows, columns, ledgerExtract, chunkSize),
  });
}
