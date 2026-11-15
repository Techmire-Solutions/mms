import { FINANCE_MODULE_MANIFEST, type FinanceTransferEntity } from "@mms/shared";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { financeUseCases } from "../finance/use-cases/financeUseCases.js";
import { findStudentsByNames } from "../db/repositories/hasanatBatchRepository.js";
import { buildFinanceCsvExport } from "./financeExportService.js";

/** Registers both finance grid runners (invoice CSV export + import). */
export function registerFinanceJobRunners(): void {
  registerFinanceExportJobRunner();
  registerFinanceImportJobRunner();
}

/** `finance:export` — invoice CSV export via the shared transfer schema. */
export function registerFinanceExportJobRunner(): void {
  registerModuleCsvExportJobRunner({
    moduleId: FINANCE_MODULE_MANIFEST.moduleId,
    entityNounPlural: "invoices",
    buildExport: (query, options, tenant, signal) =>
      buildFinanceCsvExport(
        query as Record<string, unknown>,
        {
          columns: options.columns,
          filename: options.filename,
          viewerRole: options.viewerRole,
          allowDeleted: options.allowDeleted,
        },
        tenant,
        signal,
      ),
  });
}

/**
 * `finance:import` background runner — bulk-creates invoices from the transfer schema.
 *
 * `recipient` is resolved to a student id by name once per batch; the CSV never carries a
 * discount/class/session/fee-structure, so imported invoices are created at the row `amount`
 * with no discount and `pending` status. `createInvoice` posts the journal and audits the row.
 */
export function registerFinanceImportJobRunner(): void {
  registerModuleCsvImportJobRunner<FinanceTransferEntity>({
    moduleId: "finance",
    entityNounPlural: "invoices",
    importBatch: async (rows, ctx) => {
      const names = rows.map((r) => r.recipient?.trim() ?? "").filter(Boolean);
      const studentRows = await findStudentsByNames(ctx.tenant, names);
      const studentsByName = new Map<string, { id: string; name: string }>();
      for (const s of studentRows) {
        studentsByName.set(s.studentName.trim().toLowerCase(), {
          id: s.studentId,
          name: s.studentName,
        });
      }

      let imported = 0;
      const errors: Array<{ row: number; reason: string }> = [];
      for (let index = 0; index < rows.length; index += 1) {
        throwIfBackgroundJobAborted(ctx.signal);
        const row = rows[index];
        const recipient = row.recipient?.trim() ?? "";
        const student = studentsByName.get(recipient.toLowerCase());
        if (!student) {
          errors.push({ row: index + 1, reason: `Student "${recipient}" not found` });
        } else {
          try {
            const amount = Number(row.amount ?? 0);
            await financeUseCases.createInvoice({
              studentId: student.id,
              studentName: recipient,
              baseFee: amount,
              finalAmt: amount,
              discountValue: 0,
              discountAmt: 0,
              dueDate: row.dueDate ?? new Date().toISOString().slice(0, 10),
              status: "pending",
              method: row.paymentMethod ?? null,
              invoiceNumber: row.invoiceNumber,
              class: "",
              session: "",
            });
            imported += 1;
          } catch (error) {
            errors.push({
              row: index + 1,
              reason: error instanceof Error ? error.message.slice(0, 300) : "Invalid row",
            });
          }
        }
        if ((index + 1) % 10 === 0 || index + 1 === rows.length) {
          await ctx.updateProgress(index + 1, rows.length);
        }
      }

      return { imported, failed: errors.length, total: rows.length, errors };
    },
  });
}
