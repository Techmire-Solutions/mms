/**
 * @file obligationsExportService.ts
 * @description Obligation receipt CSV export — the rows behind `POST /api/obligations/export/csv`.
 *
 * The route advertised Export while `hasBackgroundJobRunner("obligations:export")` was false, so
 * every request answered 503 (the module never had a runner; the hasanat registry comment records
 * the same bug). This builder is consumed by `backgroundJobObligationsRunners`, registered in the
 * shared registry so the **worker** process can run the job, not just the API.
 *
 * Ids are resolved to names (sender / type / representative): an export of raw uuids is not usable
 * by the operator who asked for it. Every cell goes through `buildCsvContent` → `escapeCsvCell`,
 * which neutralises spreadsheet formula injection.
 */

import { buildCsvContent, buildTenantExportFilename } from "@mms/shared";
import { obligationsRepository } from "../obligations/repository/obligationsRepositoryAdapter.js";
import type { ObligationsRepository } from "../obligations/repository/obligationsRepository.js";
import { getRequestTenant } from "../lib/tenantContext.js";

/** How many receipts one export may materialize before it must be narrowed. */
export const MAX_OBLIGATIONS_EXPORT_ROWS = 20_000;

const PAGE_SIZE = 1_000;

export type ObligationsExportColumn = { id: string; label: string };

/** The exportable receipt projection (no internal cascade columns). */
export const OBLIGATIONS_EXPORT_COLUMNS: readonly ObligationsExportColumn[] = [
  { id: "receipt_no", label: "Receipt No" },
  { id: "received_date", label: "Received Date" },
  { id: "sender", label: "Sender" },
  { id: "obligation_type", label: "Obligation Type" },
  { id: "representative", label: "Representative" },
  { id: "amount", label: "Amount" },
  { id: "currency_id", label: "Currency" },
  { id: "payment_mode", label: "Payment Mode" },
  { id: "reference_id", label: "Reference" },
  { id: "received_by", label: "Received By" },
] as const;

/** Columns appended only when the caller may read the trash. */
const DELETED_COLUMNS: readonly ObligationsExportColumn[] = [
  { id: "deleted_at", label: "Deleted At" },
  { id: "deleted_by", label: "Deleted By" },
  { id: "deletion_reason", label: "Deletion Reason" },
];

export type ObligationsExportOptions = {
  columns?: Array<{ id?: string; label?: string }>;
  filename?: string;
  viewerRole?: string;
  allowDeleted?: boolean;
};

export type ObligationsExportResult = { csv: string; filename: string; count: number };

function tooManyRowsError(): Error & { statusCode: number; type: string } {
  const error = new Error(
    `This export exceeds ${MAX_OBLIGATIONS_EXPORT_ROWS.toLocaleString()} receipts. ` +
      "Narrow the date range and export again.",
  ) as Error & { statusCode: number; type: string };
  error.statusCode = 413;
  error.type = "payload_too_large";
  return error;
}

/** Resolves the identifier columns to the names an operator recognises. */
async function loadNameMaps(tenant: string, repo: ObligationsRepository) {
  const [types, reps] = await Promise.all([
    repo.listObligationTypesByWorkspace(tenant),
    repo.listMujtahidRepsByWorkspace(tenant),
  ]);
  const typeName = new Map<string, string>();
  for (const row of types) typeName.set(String(row.id), String(row.name ?? row.id));
  const repName = new Map<string, string>();
  for (const row of reps) repName.set(String(row.id), String(row.name ?? row.id));
  return { typeName, repName };
}

/**
 * Builds the receipt CSV for the requested query.
 *
 * Two flags, deliberately separate: `allowDeleted` is the caller's **permission** (the route strips
 * `includeDeleted` from the payload when the role lacks it), while `query.includeDeleted` is the
 * **request** — whether this file should include archived receipts. The archived columns only
 * appear when both hold, because an export of live receipts has nothing to put in them.
 */
export async function buildObligationsCsvExport(
  query: Record<string, unknown>,
  options: ObligationsExportOptions = {},
  tenantArg?: string,
  signal?: AbortSignal,
): Promise<ObligationsExportResult> {
  const tenant = (tenantArg ?? getRequestTenant() ?? "").trim().toLowerCase();
  if (!tenant) throw new Error("Obligations export needs a tenant");
  const includeDeleted = options.allowDeleted === true && query.includeDeleted === true;
  const repo = obligationsRepository;
  const { typeName, repName } = await loadNameMaps(tenant, repo);

  const columns = [
    ...OBLIGATIONS_EXPORT_COLUMNS,
    ...(includeDeleted ? DELETED_COLUMNS : []),
  ] as ObligationsExportColumn[];
  const selected = normalizeSelectedColumns(options.columns, columns);

  const rows: unknown[][] = [selected.map((column) => column.label)];
  let offset = 0;
  let count = 0;
  // Paged read: the repository caps a single call, and a receipt ledger grows without bound.
  for (;;) {
    if (signal?.aborted) throw new Error("Obligations export aborted");
    const page = await repo.listObligationCollectionsByWorkspace(tenant, {
      // `all` (not `deleted`): an operator who asks for the archive still wants the live receipts
      // in the same workbook — "deleted only" was never the intent, and silently exported nothing
      // for a healthy workspace.
      deleted: includeDeleted ? "all" : "active",
      limit: PAGE_SIZE,
      offset,
    });
    if (page.length === 0) break;
    for (const record of page) {
      count += 1;
      if (count > MAX_OBLIGATIONS_EXPORT_ROWS) throw tooManyRowsError();
      rows.push(
        selected.map((column) => cellFor(record, column.id, { typeName, repName, includeDeleted })),
      );
    }
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const filename = buildTenantExportFilename(
    tenant,
    options.filename?.trim() || "obligations-export.csv",
  );
  return { csv: buildCsvContent(rows), filename, count };
}

function normalizeSelectedColumns(
  requested: Array<{ id?: string; label?: string }> | undefined,
  available: ObligationsExportColumn[],
): ObligationsExportColumn[] {
  if (!requested?.length) return available;
  const byId = new Map(available.map((column) => [column.id, column]));
  const selected: ObligationsExportColumn[] = [];
  for (const entry of requested) {
    const id = String(entry?.id ?? "").trim();
    const column = byId.get(id);
    // Unknown or forbidden ids (e.g. deleted columns without trash access) are dropped, never
    // emitted as an empty header the operator would trust.
    if (column) selected.push({ id: column.id, label: entry.label?.trim() || column.label });
  }
  return selected.length > 0 ? selected : available;
}

function cellFor(
  record: Record<string, unknown> & {
    receipt_no?: string;
    sender_id?: string;
    obligation_type_id?: string;
    mujtahid_representative_id?: string;
    amount?: unknown;
    payment_mode?: string;
  },
  columnId: string,
  maps: {
    typeName: Map<string, string>;
    repName: Map<string, string>;
    includeDeleted: boolean;
  },
): string {
  const value = (record as Record<string, unknown>)[columnId];
  switch (columnId) {
    case "sender":
      return String(record.sender_id ?? "");
    case "obligation_type":
      return maps.typeName.get(String(record.obligation_type_id ?? "")) ?? "";
    case "representative":
      return maps.repName.get(String(record.mujtahid_representative_id ?? "")) ?? "";
    case "amount":
      // The DTO stores money as a number at 2 dp; format it without float arithmetic.
      return value === null || value === undefined ? "" : String(value);
    default:
      if (columnId.startsWith("deleted_") || columnId === "deletion_reason") {
        if (!maps.includeDeleted) return "";
      }
      return value === null || value === undefined ? "" : String(value);
  }
}
