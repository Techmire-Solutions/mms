import { createHash } from "node:crypto";
import { parseSessionStatus, type SessionTransferEntity } from "@mms/shared";
import { registerModuleCsvImportJobRunner } from "../../lib/registerModuleCsvImportJobRunner.js";
import { throwIfBackgroundJobAborted } from "../../lib/backgroundJobAbort.js";
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
      // Retries re-enter this loop with the same job id: deterministic row ids make the import
      // idempotent (imported rows are skipped), while progress writes are throttled.
      const importIdForRow = (index: number): string =>
        `imp-${createHash("sha256").update(`${ctx.jobId}:${index}`).digest("hex").slice(0, 24)}`;
      let lastReportAt = 0;
      let lastCount = 0;
      const report = async (current: number, total: number): Promise<void> => {
        const now = Date.now();
        if (
          current >= total ||
          now - lastReportAt >= 1000 ||
          current - lastCount >= Math.max(1, Math.ceil(total * 0.02))
        ) {
          lastReportAt = now;
          lastCount = current;
          await ctx.updateProgress(current, Math.max(total, 1));
        }
      };

      for (let index = 0; index < rows.length; index += 1) {
        throwIfBackgroundJobAborted(ctx.signal);
        const row = rows[index];
        const name = row.name?.trim();
        // A CSV row may only create a draft/intake session; later states must go through the
        // lifecycle so their guards and side effects run (imported history stays explicit).
        let status = "draft";
        try {
          status = parseSessionStatus(row.status ?? "draft");
        } catch {
          failed += 1;
          errors.push({ row: index + 1, reason: `Unknown session status: ${String(row.status)}` });
          await report(index + 1, rows.length);
          continue;
        }
        if (status !== "draft" && status !== "open") {
          failed += 1;
          errors.push({
            row: index + 1,
            reason: `Imported sessions start as draft or open, not ${status}`,
          });
        } else if (!name) {
          failed += 1;
          errors.push({ row: index + 1, reason: "Session name is required" });
        } else {
          try {
            const sessionId = importIdForRow(index);
            const already = await runWithTenant(ctx.tenant, () =>
              sessionsUseCases.loadSessionById(sessionId),
            );
            if (already) {
              // Idempotent retry: the row was imported by an earlier attempt of this job.
              imported += 1;
              await report(index + 1, rows.length);
              continue;
            }
            await runWithTenant(ctx.tenant, () =>
              sessionsUseCases.createSession({
                id: sessionId,
                name,
                type: row.type?.trim() ?? "",
                status,
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
        await report(index + 1, rows.length);
      }

      return { imported, failed, total: rows.length, errors };
    },
  });
}
