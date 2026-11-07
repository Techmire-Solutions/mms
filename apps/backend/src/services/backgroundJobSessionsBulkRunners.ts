import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";
import { sessionsUseCases } from "../sessions/use-cases/sessionsUseCases.js";
import { sessionsBulkArchiveJobBodySchema, sessionsBulkStatusJobBodySchema } from "@mms/shared";

/** Async bulk lifecycle/archive runners (large selections no longer run inside a request). */
export function registerSessionsBulkJobRunners(): void {
  registerBackgroundJobRunner("sessions:bulk-status", async (payload, ctx) => {
    const body = sessionsBulkStatusJobBodySchema.parse(payload);
    const result = await sessionsUseCases.bulkUpdateSessionsStatus(
      body.ids.map(String),
      body.status,
      body.reason,
    );
    await ctx.complete({
      label: `Bulk status ${body.status}: ${result.succeeded} updated, ${result.failed} failed`,
      progress: { current: result.succeeded, total: Math.max(body.ids.length, 1) },
    });
  });

  registerBackgroundJobRunner("sessions:bulk-archive", async (payload, ctx) => {
    const body = sessionsBulkArchiveJobBodySchema.parse(payload);
    const result = await sessionsUseCases.bulkSoftDeleteSessions(
      body.ids.map(String),
      ctx.userId,
      body.deletionReason,
    );
    await ctx.complete({
      label: `Bulk archive: ${result.succeeded} archived, ${result.failed} failed`,
      progress: { current: result.succeeded, total: Math.max(body.ids.length, 1) },
    });
  });
}
