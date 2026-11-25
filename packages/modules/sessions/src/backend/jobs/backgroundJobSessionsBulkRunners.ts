import { registerBackgroundJobRunner } from "@mms/be-core/jobs";
import { sessionsUseCases } from "../use-cases/sessionsUseCases.js";
import { sessionsBulkArchiveJobBodySchema, sessionsBulkStatusJobBodySchema } from "@mms/contracts";
import { withTenant } from "@mms/db/context";
import { getRequestTenant } from "@mms/be-core/http";

/** Async bulk lifecycle/archive runners (large selections no longer run inside a request). */
export function registerSessionsBulkJobRunners(): void {
  registerBackgroundJobRunner("sessions:bulk-status", async (payload: any, ctx: any) => {
    const body = sessionsBulkStatusJobBodySchema.parse(payload);
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required for bulk status");
    // One transaction with per-item savepoints, matching the HTTP path's atomicity.
    const result = await withTenant(tenant, () =>
      sessionsUseCases.bulkUpdateSessionsStatus(body.ids.map(String), body.status, body.reason),
    );
    await ctx.complete({
      label: `Bulk status ${body.status}: ${result.succeeded} updated, ${result.failed} failed`,
      progress: { current: result.succeeded, total: Math.max(body.ids.length, 1) },
    });
  });

  registerBackgroundJobRunner("sessions:bulk-archive", async (payload: any, ctx: any) => {
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
