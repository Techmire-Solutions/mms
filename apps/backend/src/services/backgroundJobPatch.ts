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
  patch: Omit<Partial<BackgroundJobRecord>, "completedAt" | "error"> & {
    completedAt?: string | null;
    error?: string | null;
    errors?: Array<{ row: number; reason: string }> | null;
    deadLetteredAt?: Date | null;
  },
): Promise<BackgroundJobRecord> {
  if (!tenantId) throw new Error("Tenant context is required to patch background job");

  const updateValues: {
    status?: string;
    label?: string;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    error?: string | null;
    errors?: Array<{ row: number; reason: string }> | null;
    hasDownload?: boolean;
    payload?: Record<string, unknown>;
    completedAt?: Date | null;
    deadLetteredAt?: Date | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (patch.status !== undefined) updateValues.status = patch.status;
  // Terminal jobs keep their counts/labels/errors; the row payload (CSV import rows = PII) is
  // dropped so it cannot linger in `background_jobs` until the user dismisses the job.
  if (patch.status === "completed" || patch.status === "failed") updateValues.payload = {};
  if (patch.label !== undefined) updateValues.label = patch.label;
  if (patch.progress !== undefined) {
    updateValues.progressCurrent = patch.progress.current;
    updateValues.progressTotal = patch.progress.total;
  }
  if (patch.error !== undefined) updateValues.error = patch.error;
  if (patch.errors !== undefined) updateValues.errors = patch.errors;
  if (patch.hasDownload !== undefined) updateValues.hasDownload = patch.hasDownload;
  if (patch.completedAt !== undefined) {
    updateValues.completedAt = patch.completedAt ? new Date(patch.completedAt) : null;
  }
  if (patch.deadLetteredAt !== undefined) {
    updateValues.deadLetteredAt = patch.deadLetteredAt;
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
