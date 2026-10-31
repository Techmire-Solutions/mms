import { and, eq } from "drizzle-orm";
import type { BackgroundJobRecord } from "@mms/shared";
import { withTenant } from "../db/tenant-context.js";
import { backgroundJobs } from "../db/schema.js";
import { rowToJobRecord } from "./backgroundJobService.js";

/** Patches a background-job row inside its tenant transaction. */
export async function patchJob(
  tenantId: string,
  _userId: string,
  jobId: string,
  patch: Partial<BackgroundJobRecord>,
): Promise<BackgroundJobRecord> {
  if (!tenantId) throw new Error("Tenant context is required to patch background job");

  const updateValues: {
    status?: string;
    label?: string;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    error?: string | null;
    hasDownload?: boolean;
    completedAt?: Date | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (patch.status !== undefined) updateValues.status = patch.status;
  if (patch.label !== undefined) updateValues.label = patch.label;
  if (patch.progress !== undefined) {
    updateValues.progressCurrent = patch.progress.current;
    updateValues.progressTotal = patch.progress.total;
  }
  if (patch.error !== undefined) updateValues.error = patch.error;
  if (patch.hasDownload !== undefined) updateValues.hasDownload = patch.hasDownload;
  if (patch.completedAt !== undefined) {
    updateValues.completedAt = patch.completedAt ? new Date(patch.completedAt) : null;
  }

  const [updated] = await withTenant(tenantId, async (tx) => {
    return tx
      .update(backgroundJobs)
      .set(updateValues)
      .where(and(eq(backgroundJobs.tenantId, tenantId), eq(backgroundJobs.id, jobId)))
      .returning();
  });

  if (!updated) {
    throw new Error(`Background job ${jobId} not found for tenant ${tenantId}`);
  }

  return rowToJobRecord(updated);
}
