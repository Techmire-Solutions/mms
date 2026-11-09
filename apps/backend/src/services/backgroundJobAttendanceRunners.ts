import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import {
  buildAttendanceCsvExport,
  generateAttendanceCsvStreamChunks,
} from "./attendanceExportService.js";
import { scanAbsenceStreaks } from "../attendance/use-cases/attendanceEscalationUseCases.js";
import { logger } from "../lib/logger.js";

/**
 * Attendance job runners.
 *
 * Two paths had none:
 * - `attendance:export` — the CSV export route enqueued it, so every export died three attempts
 *   later in the DLQ while the API had already answered 202.
 * - `attendance:absence-scan` — the manual scan ran inline inside the HTTP request, with no retry,
 *   no deadline and no job record.
 *
 * The scheduled hourly sweep stays in `worker/attendanceAbsenceScheduler.ts` (one leader, no per-hour
 * queue overhead); only the on-demand scan is a queue job.
 */
export function registerAttendanceJobRunners(): void {
  registerModuleCsvExportJobRunner({
    moduleId: ATTENDANCE_MODULE_MANIFEST.moduleId,
    entityNounPlural: "attendance records",
    // The runner passes `unknown` for columns; the service narrows them against the catalog.
    buildExport: buildAttendanceCsvExport as never,
    generateStreamChunks: generateAttendanceCsvStreamChunks as never,
  });

  registerBackgroundJobRunner("attendance:absence-scan", async (payload, ctx) => {
    const options = (payload ?? {}) as { requestedBy?: unknown };
    logger.info(
      { jobId: ctx.jobId, tenant: ctx.tenant, requestedBy: options.requestedBy },
      "[AttendanceAbsence] Manual scan job started",
    );
    await ctx.updateProgress(0, 1);
    // One workspace per job. The scan is idempotent per streak (unique alert key + notification
    // claim), so a retry after a partial run cannot duplicate alerts or notifications.
    const result = await scanAbsenceStreaks(ctx.tenant);
    await ctx.complete({
      label: `Absence scan: ${result.alertsRaised} raised, ${result.alertsUpdated} updated`,
      progress: { current: 1, total: 1 },
    });
    logger.info(
      {
        jobId: ctx.jobId,
        tenant: ctx.tenant,
        studentsScanned: result.studentsScanned,
        streaksFound: result.streaksFound,
        alertsRaised: result.alertsRaised,
        alertsUpdated: result.alertsUpdated,
      },
      "[AttendanceAbsence] Manual scan job completed",
    );
  });
}
