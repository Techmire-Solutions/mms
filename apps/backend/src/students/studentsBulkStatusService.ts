import { registerBackgroundJobRunner } from "../services/backgroundJobWorkerService.js";
import { studentUseCases } from "./use-cases/studentUseCases.js";
import { studentsBulkStatusSchema, type User } from "@mms/shared";
import { withTenant } from "../db/tenant-context.js";

/**
 * Registers the `students:bulk-status` background job runner.
 *
 * Used for asynchronous batch status updates of student cohorts, preventing HTTP request timeouts
 * and isolating database locks.
 */
export function registerStudentsBulkJobRunners(): void {
  registerBackgroundJobRunner("students:bulk-status", async (payload, ctx) => {
    const body = studentsBulkStatusSchema.parse(payload);
    const user = {
      id: ctx.userId,
      role: "admin",
      permissions: ["students.write"],
    } as unknown as User;

    const result = await withTenant(
      ctx.tenant,
      () => studentUseCases.bulkUpdateStudentStatus(body.ids.map(String), body.status, user),
      { readOnly: false },
    );

    await ctx.complete({
      label: `Bulk status ${body.status}: ${result.succeeded} updated, ${result.failed} failed`,
      progress: { current: result.succeeded, total: Math.max(body.ids.length, 1) },
    });
  });
}
