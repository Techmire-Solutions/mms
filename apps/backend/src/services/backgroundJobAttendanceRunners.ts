import { ATTENDANCE_MODULE_MANIFEST, buildTenantExportFilename } from "@mms/shared";
import { PassThrough } from "node:stream";
import {
  resolveTenantExportKey,
  uploadBufferToStorage,
  uploadStreamToStorage,
} from "../config/storage.js";
import { saveStreamedExportArtifact } from "./exportArtifactService.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { buildXlsxBuffer } from "../lib/xlsxExportSerializer.js";
import {
  buildAttendanceMatrixGrid,
  generateAttendanceMatrixCsv,
  resolveMatrixDates,
  type MatrixExportRequest,
} from "./attendanceMatrixExportService.js";
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

  /**
   * Register / monthly matrix export.
   *
   * CSV streams chunk by chunk through a `PassThrough` (drain-backed), so the matrix never exists in
   * memory. XLSX is materialised but capped by `ATTENDANCE_MATRIX_MAX_CELLS`.
   */
  registerBackgroundJobRunner("attendance:matrix-export", async (payload, ctx) => {
    const data = (payload ?? {}) as {
      request?: MatrixExportRequest;
      format?: "csv" | "xlsx";
      className?: string;
      sectionName?: string;
    };
    const request = data.request;
    if (!request) throw new Error("Matrix export payload is missing its request");
    const format = data.format === "xlsx" ? "xlsx" : "csv";
    const resolved = resolveMatrixDates(request);
    if (!resolved.ok) throw new Error(resolved.message);

    const scope = [request.classId, request.sectionId, `${request.dateFrom}_${request.dateTo}`]
      .filter(Boolean)
      .join("-");
    const baseName = buildTenantExportFilename(
      ctx.tenant,
      `attendance-register-${scope}.${format}`,
    );

    ctx.updateProgress(0, 1).catch(() => {});
    if (format === "xlsx") {
      const grid = await buildAttendanceMatrixGrid(request, {
        tenant: ctx.tenant,
        className: data.className,
        sectionName: data.sectionName,
      });
      const buffer = await buildXlsxBuffer(grid);
      const xlsxKey = resolveTenantExportKey(ctx.tenant, baseName);
      const stored = await uploadBufferToStorage(
        ctx.tenant,
        xlsxKey,
        buffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
        key: xlsxKey,
        storageType: stored.storageType,
        filename: baseName,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      await ctx.complete({
        label: `Register exported: ${grid.length - 2} students`,
        progress: { current: 1, total: 1 },
      });
      return;
    }

    const passThrough = new PassThrough();
    const key = resolveTenantExportKey(ctx.tenant, baseName);
    const upload = uploadStreamToStorage(ctx.tenant, key, passThrough, "text/csv; charset=utf-8", {
      signal: ctx.signal,
    });
    let bytes = 0;
    try {
      const generator = generateAttendanceMatrixCsv(request, {
        tenant: ctx.tenant,
        className: data.className,
        sectionName: data.sectionName,
      });
      for await (const chunk of generator) {
        throwIfBackgroundJobAborted(ctx.signal);
        bytes += chunk.length;
        if (!passThrough.write(chunk)) {
          await new Promise<void>((resolve) => passThrough.once("drain", () => resolve()));
        }
      }
    } finally {
      passThrough.end();
    }
    const stored = await upload;
    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key,
      storageType: stored.storageType,
      filename: baseName,
      contentType: "text/csv; charset=utf-8",
    });
    await ctx.complete({
      label: `Register exported (${Math.max(1, Math.round(bytes / 1024))} KB)`,
      progress: { current: 1, total: 1 },
    });
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
