import { createHash } from "node:crypto";
import type { AcademicCalendarEventWrite } from "@mms/shared";
import { registerModuleCsvImportJobRunner } from "../../lib/registerModuleCsvImportJobRunner.js";
import { throwIfBackgroundJobAborted } from "../../lib/backgroundJobAbort.js";
import { academicCalendarUseCases } from "./academicCalendarUseCases.js";

type AcademicCalendarImportRow = AcademicCalendarEventWrite & { id?: string };

/**
 * `attendance-calendar:import` background runner. Each row is one academic-calendar event
 * (holiday / make-up day / exam period / event). Deterministic ids make a BullMQ retry after a
 * partial run idempotent; per-row failures are collected, not thrown.
 */
export function registerAcademicCalendarImportJobRunner(): void {
  registerModuleCsvImportJobRunner<AcademicCalendarImportRow>({
    moduleId: "attendance-calendar",
    entityNounPlural: "academic calendar events",
    importBatch: async (rows, ctx) => {
      let imported = 0;
      const errors: Array<{ row: number; reason: string }> = [];
      const importIdForRow = (index: number): string =>
        `imp-${createHash("sha256").update(`${ctx.jobId}:${index}`).digest("hex").slice(0, 24)}`;

      for (let index = 0; index < rows.length; index += 1) {
        throwIfBackgroundJobAborted(ctx.signal);
        const row = rows[index];
        try {
          await academicCalendarUseCases.save(
            ctx.tenant,
            row.id || importIdForRow(index),
            row,
            ctx.userId,
          );
          imported += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message.slice(0, 300) : "Invalid row";
          errors.push({ row: index + 1, reason });
        }
        if (index % 10 === 0 || index === rows.length - 1) {
          await ctx.updateProgress(index + 1, rows.length);
        }
      }

      return { imported, failed: errors.length, total: rows.length, errors };
    },
  });
}
