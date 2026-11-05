import { randomUUID } from "node:crypto";
import { normalizeSessionStatus, type SessionTransferEntity } from "@mms/shared";
import { registerModuleCsvImportJobRunner } from "../../lib/registerModuleCsvImportJobRunner.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { sessionsUseCases } from "./sessionsUseCases.js";

/**
 * `sessions:import` background runner. Each CSV row creates a flat session (no classes/faculty):
 * the transfer schema's `duration`, `capacity`, `classesCount`, `facultyCount` and `notes` are
 * derived/export-only columns and are intentionally ignored on import.
 */
export function registerSessionImportJobRunner(): void {
  registerModuleCsvImportJobRunner<SessionTransferEntity>({
    moduleId: "sessions",
    entityNounPlural: "sessions",
    importBatch: async (rows, ctx) => {
      let imported = 0;
      let failed = 0;
      const errors: Array<{ row: number; reason: string }> = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const name = row.name?.trim();
        if (!name) {
          failed += 1;
          errors.push({ row: index + 1, reason: "Session name is required" });
        } else {
          try {
            await runWithTenant(ctx.tenant, () =>
              sessionsUseCases.createSession({
                id: randomUUID(),
                name,
                type: row.type?.trim() ?? "",
                status: normalizeSessionStatus(row.status),
                startDate: row.startDate?.trim().slice(0, 10) ?? "",
                endDate: row.endDate?.trim().slice(0, 10) ?? "",
                baseFee: Number(row.baseFee ?? 0) || 0,
                currency: row.currency?.trim() || "PKR",
                description: row.description?.trim() ?? "",
                classes: [],
                faculty: [],
                workingDays: [],
              } as never),
            );
            imported += 1;
          } catch (error) {
            failed += 1;
            errors.push({
              row: index + 1,
              reason: error instanceof Error ? error.message : "Import failed",
            });
          }
        }
        await ctx.updateProgress(index + 1, Math.max(rows.length, 1));
      }

      return { imported, failed, total: rows.length, errors };
    },
  });
}
