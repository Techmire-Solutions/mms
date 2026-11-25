/**
 * @file backgroundJobObligationsRunners.ts
 * @description Background-job runners for the Obligations module.
 *
 * Registered by the shared default registry (`registerDefaultBackgroundJobRunners`), not by the
 * route plugin: the API and the worker are separate processes, and a runner registered only in the
 * API makes the enqueue succeed and then dead-letter in the worker.
 */
import { getDisplayName, type ObligationTransferEntity } from "@mms/contracts";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import { throwIfBackgroundJobAborted } from "@mms/be-core/jobs/backgroundJobAbort";
import { OBLIGATIONS_MODULE_MANIFEST } from "@mms/contracts";
import {
  buildObligationsCsvExport,
  type ObligationsExportOptions,
} from "@mms/mod-obligations/backend/services";
import { obligationsUseCases } from "@mms/mod-obligations/backend/use-cases";
import { obligationsRepository } from "@mms/mod-obligations/backend/repository";
import { loadContactsPage } from "@mms/mod-contacts/backend/use-cases";

export function registerObligationsJobRunners(): void {
  registerModuleCsvExportJobRunner({
    moduleId: OBLIGATIONS_MODULE_MANIFEST.moduleId,
    entityNounPlural: "obligation receipts",
    buildExport: (query, options, tenant, signal) =>
      buildObligationsCsvExport(
        query as Record<string, unknown>,
        options as ObligationsExportOptions,
        tenant,
        signal,
      ),
  });
  registerObligationsImportJobRunner();
}

/** `obligations:import` — resolves the schema's names to ids and bulk-creates receipts. */
export function registerObligationsImportJobRunner(): void {
  registerModuleCsvImportJobRunner<ObligationTransferEntity>({
    moduleId: "obligations",
    entityNounPlural: "obligations",
    importBatch: async (rows, ctx) => {
      const tenant = ctx.tenant;
      const [types, reps] = await Promise.all([
        obligationsRepository.listObligationTypesByWorkspace(tenant),
        obligationsRepository.listMujtahidRepsByWorkspace(tenant),
      ]);
      const typeByName = new Map(types.map((t) => [t.name.trim().toLowerCase(), t.id]));
      const repByName = new Map(reps.map((r) => [r.name.trim().toLowerCase(), r.id]));

      // Resolve donors (unique names) via contact search — one search per distinct donor name.
      const donorNames = [
        ...new Set(rows.map((r) => r.donorName?.trim()).filter((n): n is string => Boolean(n))),
      ];
      const donorByName = new Map<string, string>();
      for (const name of donorNames) {
        const page = await loadContactsPage({
          search: name,
          page: 1,
          limit: 20,
        } as never);
        const match = page.contacts.find(
          (c) =>
            getDisplayName(c as never)
              .trim()
              .toLowerCase() === name.toLowerCase(),
        );
        if (match) donorByName.set(name.toLowerCase(), String(match.id));
      }

      let imported = 0;
      const errors: Array<{ row: number; reason: string }> = [];
      for (let index = 0; index < rows.length; index += 1) {
        throwIfBackgroundJobAborted(ctx.signal);
        const row = rows[index];
        const typeId = typeByName.get((row.obligationType ?? "").trim().toLowerCase());
        if (!typeId) {
          errors.push({
            row: index + 1,
            reason: `Obligation type "${row.obligationType}" not found`,
          });
        } else {
          const repId = repByName.get((row.representative ?? "").trim().toLowerCase());
          if (!repId) {
            errors.push({
              row: index + 1,
              reason: `Representative "${row.representative}" not found`,
            });
          } else {
            const senderId = donorByName.get((row.donorName ?? "").trim().toLowerCase());
            if (!senderId) {
              errors.push({ row: index + 1, reason: `Donor "${row.donorName}" not found` });
            } else {
              try {
                await obligationsUseCases.createObligationCollection({
                  receipt_no: row.receiptNo,
                  received_date: row.receivedDate,
                  sender_id: senderId,
                  reference_id: row.reference ?? null,
                  amount: Number(row.amount),
                  currency_id: row.currency ?? "PKR",
                  payment_mode: row.paymentMode === "Online" ? "Online" : "Cash",
                  obligation_type_id: typeId,
                  mujtahid_representative_id: repId,
                  received_by: ctx.userId,
                } as never);
                imported += 1;
              } catch (error) {
                errors.push({
                  row: index + 1,
                  reason: error instanceof Error ? error.message.slice(0, 300) : "Invalid row",
                });
              }
            }
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
