import type { FinanceRepository } from "./repository/financeRepository.js";
import {
  invoiceTotalsFromLines,
  resolveFamilyContactId,
  type Invoice,
  type InvoiceCreateInput,
  type InvoiceUpdate,
} from "@mms/shared";
import type { createGenericRelationalService } from "../services/genericRelationalService.js";
import { allocateNextInvoiceNumber } from "../db/repositories/financeBillingRepository.js";
import { tryPostInvoiceJournal } from "../accounting/ledgerPosting/ledgerPostingService.js";
import { resolveDocumentFx } from "./use-cases/financeDocumentFx.js";
import { loadFinanceModulePreferences } from "../services/financePreferencesService.js";
import { withTenant } from "../db/tenant-context.js";
import { HttpDomainError } from "../lib/httpErrors.js";
import { invoiceAuditState, recordInvoiceAudit } from "./use-cases/financeAuditEvents.js";

const LEDGER_SENSITIVE_INVOICE_AMOUNTS = [
  "finalAmt",
  "discountAmt",
  "lateFeeAmt",
  "paidAmt",
] as const satisfies readonly (keyof Invoice)[];

/** Statuses whose persisted value changes the subledger balance with no posting. */
const LEDGER_AFFECTING_INVOICE_STATUSES = new Set<Invoice["status"]>(["cancelled", "paid"]);

/**
 * A POST with an explicit id may replay an earlier request (the specialized
 * fee-entry pipeline relies on this). Only an exact replay of the same
 * student/amount/due-date/status may return the stored invoice; any other id
 * collision must fail instead of overwriting a settled invoice.
 */
function isIdempotentInvoiceReplay(
  existing: Invoice,
  expected: { studentId?: string; finalAmt: number; dueDate: string; status: string },
): boolean {
  if (existing.deletedAt) return false;
  // A replay may arrive after the fee pipeline also recorded the payment, so a
  // settled invoice (paid/partial) is still the same invoice. It is returned
  // unchanged — never reset — which is the point of the guard.
  const statusMatches =
    existing.status === expected.status ||
    (expected.status === "pending" &&
      (existing.status === "paid" || existing.status === "partial"));
  return (
    existing.studentId === expected.studentId &&
    Math.round(Number(existing.finalAmt ?? 0) * 100) ===
      Math.round(Number(expected.finalAmt ?? 0) * 100) &&
    existing.dueDate === expected.dueDate &&
    statusMatches
  );
}

function cents(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100);
}

/**
 * Fields whose persisted change silently desynchronises the invoice from its
 * posted journal: the four amounts, the credited total, and the two statuses
 * (`cancelled`, `paid`) that zero the subledger balance.
 */
function ledgerSensitiveInvoiceChanges(existing: Invoice, incoming: Partial<Invoice>): string[] {
  const changed: string[] = [];
  for (const field of LEDGER_SENSITIVE_INVOICE_AMOUNTS) {
    if (incoming[field] !== undefined && cents(incoming[field]) !== cents(existing[field])) {
      changed.push(field);
    }
  }
  if (
    incoming.creditedAmt !== undefined &&
    cents(incoming.creditedAmt) !== cents(existing.creditedAmt)
  ) {
    changed.push("creditedAmt");
  }
  if (
    incoming.status !== undefined &&
    incoming.status !== existing.status &&
    LEDGER_AFFECTING_INVOICE_STATUSES.has(incoming.status)
  ) {
    changed.push("status");
  }
  return changed;
}

async function assertInvoiceLedgerFieldsEditable(
  repo: FinanceRepository,
  tenant: string,
  invoiceId: string,
  incoming: Partial<Invoice>,
  allowLedgerSensitive: boolean,
): Promise<void> {
  if (allowLedgerSensitive) return;

  const existing = await repo.findInvoiceById(tenant, invoiceId);
  if (!existing) return;

  const changed = ledgerSensitiveInvoiceChanges(existing, incoming);
  if (changed.length === 0) return;

  const ledgerEntryId = await repo.findLedgerPostingIdBySource(tenant, "invoice", invoiceId);
  if (!ledgerEntryId) return;

  const guidance =
    incoming.status === "cancelled"
      ? "cancel it through the cancel-invoice action so the ledger reversal is posted"
      : incoming.status === "paid"
        ? "record a payment so the collection and ledger are posted"
        : "reverse it with a credit note or adjusting entry";

  throw Object.assign(
    new Error(
      `This invoice is posted to the ledger — ${guidance} instead of editing ${changed.join(", ")}`,
    ),
    { statusCode: 422, type: "validation_error" },
  );
}

export interface FinanceInvoiceMutationDeps {
  repo: FinanceRepository;
  invoiceCrud: ReturnType<typeof createGenericRelationalService<Invoice>>;
  requireTenant: () => string;
}

export function createFinanceInvoiceMutationOperations({
  repo,
  invoiceCrud,
  requireTenant,
}: FinanceInvoiceMutationDeps) {
  return {
    createInvoice: async (record: InvoiceCreateInput): Promise<Invoice> => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const year = Number((record.dueDate ?? "").slice(0, 4)) || new Date().getFullYear();
        let prefix = "INV";
        try {
          const prefs = await loadFinanceModulePreferences();
          prefix = prefs?.invoicePrefix?.trim() || "INV";
        } catch {
          // Keep default prefix when preferences are unavailable.
        }
        const lines = (record.lines ?? []).map((line, index) => ({
          ...line,
          id: line.id ?? `il-${index + 1}`,
        }));
        const totals = lines.length > 0 ? invoiceTotalsFromLines(lines) : null;
        const expectedFinalAmt =
          totals?.finalAmt ?? Math.round(Number(record.finalAmt ?? 0) * 100) / 100;
        const expectedStatus = record.status ?? "pending";

        // POST is insert-only. A caller-supplied id is accepted only as an exact
        // replay; a different payload must not re-open a settled invoice.
        const requestedId = typeof record.id === "string" ? record.id.trim() : "";
        if (requestedId) {
          const existing = await repo.findInvoiceById(tenant, requestedId, { forUpdate: true });
          if (existing) {
            if (
              isIdempotentInvoiceReplay(existing, {
                studentId: record.studentId,
                finalAmt: expectedFinalAmt,
                dueDate: record.dueDate,
                status: expectedStatus,
              })
            ) {
              return existing;
            }
            throw new HttpDomainError(409, "conflict", "invoice id already exists");
          }
        }

        const { findStudentsByIds } = await import("../db/repositories/studentRepository.js");
        const students = record.studentId
          ? await findStudentsByIds(tenant, [record.studentId])
          : [];
        if (record.studentId && (!students[0] || students[0].deletedAt)) {
          const err = new Error("Referenced student is archived or does not exist");
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }
        const fx = await resolveDocumentFx(tenant, record, record.dueDate);
        const created = await invoiceCrud.create({
          ...record,
          currency: fx.currency,
          exchangeRate: fx.exchangeRate,
          studentId: students[0]?.id ?? record.studentId,
          familyContactId: record.familyContactId ?? resolveFamilyContactId(students[0]),
          invoiceNumber:
            record.invoiceNumber || (await allocateNextInvoiceNumber(tenant, year, prefix)),
          ...(totals
            ? {
                baseFee: totals.baseFee,
                discountAmt: totals.discountAmt,
                finalAmt: totals.finalAmt,
              }
            : {}),
          ...(lines.length > 0 ? { lines } : {}),
        } as Invoice);
        await tryPostInvoiceJournal(tenant, created);
        await recordInvoiceAudit(tenant, "CREATE", created);
        return created;
      });
    },

    updateInvoiceById: async (
      id: string,
      record: InvoiceUpdate,
      options?: { audit?: boolean; allowLedgerSensitive?: boolean },
    ): Promise<Invoice | null> => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        let resolvedStudentId = record.studentId;
        if (record.studentId) {
          const { findStudentsByIds } = await import("../db/repositories/studentRepository.js");
          const students = await findStudentsByIds(tenant, [record.studentId]);
          if (!students[0] || students[0].deletedAt) {
            const err = new Error("Referenced student is archived or does not exist");
            (err as Error & { statusCode: number }).statusCode = 400;
            throw err;
          }
          resolvedStudentId = students[0].id;
        }
        const { lines: rawLines, ...rest } = record;
        const lines = rawLines
          ? (rawLines.map((line, index) => ({
              ...line,
              id: line.id ?? `il-${index + 1}`,
            })) as Invoice["lines"])
          : undefined;
        await assertInvoiceLedgerFieldsEditable(
          repo,
          tenant,
          id,
          rest,
          options?.allowLedgerSensitive === true,
        );
        const before = await repo.findInvoiceById(tenant, id, { forUpdate: true });
        const beforeState = invoiceAuditState(before);
        const updated = await invoiceCrud.updateById(id, {
          ...rest,
          ...(resolvedStudentId ? { studentId: resolvedStudentId } : {}),
          ...(lines ? { lines } : {}),
        });
        if (updated && options?.audit !== false) {
          await recordInvoiceAudit(tenant, "UPDATE", updated, beforeState);
        }
        return updated;
      });
    },
  };
}
