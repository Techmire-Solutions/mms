import { workshopParticipantsImportSchema } from "@mms/shared";
import { throwIfBackgroundJobAborted } from "../../lib/backgroundJobAbort.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import { importParticipantChunk } from "../../db/repositories/workshopParticipantImportRepository.js";
import {
  registerBackgroundJobRunner,
  type BackgroundJobRunContext,
} from "../../services/backgroundJobWorkerService.js";

/** Contacts per transaction: small enough that a deploy abort releases locks quickly. */
export const WORKSHOP_IMPORT_CHUNK_SIZE = 100;
/** Bounded row-level errors persisted on the job (the UI/task tray renders these). */
const MAX_JOB_ERRORS = 500;

/**
 * Queued participant import (`workshops:import`).
 *
 * Idempotency has two layers: the deterministic job id collapses a double submit onto one job, and
 * each chunk skips contacts that are already registered, so a BullMQ retry after a partial run
 * continues instead of duplicating. Every chunk is its own transaction; an abort/shutdown rolls back
 * only the in-flight chunk and leaves committed progress intact.
 */
export async function runWorkshopParticipantImport(
  rawPayload: unknown,
  ctx: BackgroundJobRunContext,
): Promise<void> {
  const parsed = workshopParticipantsImportSchema.safeParse({
    contactIds: (rawPayload as { contactIds?: unknown } | null)?.contactIds,
  });
  if (!parsed.success) {
    // Invalid payload is permanent: fail without retrying (BullMQ would never fix it).
    await ctx.fail("Invalid workshop import payload");
    return;
  }
  const { workshopId } = rawPayload as { workshopId?: unknown };
  if (typeof workshopId !== "string" || workshopId.trim() === "") {
    await ctx.fail("Invalid workshop import payload: workshopId is required");
    return;
  }
  const ids = parsed.data.contactIds;
  let processed = 0;
  let added = 0;
  let waitlisted = 0;
  let skipped = 0;
  const errors: Array<{ row: number; reason: string }> = [];

  try {
    for (let offset = 0; offset < ids.length; offset += WORKSHOP_IMPORT_CHUNK_SIZE) {
      throwIfBackgroundJobAborted(ctx.signal);
      const chunk = ids.slice(offset, offset + WORKSHOP_IMPORT_CHUNK_SIZE);
      const result = await importParticipantChunk(ctx.tenant, workshopId.trim(), chunk, ctx.signal);
      added += result.added;
      waitlisted += result.waitlisted;
      skipped += result.skipped;
      for (const failure of result.failed) {
        if (errors.length >= MAX_JOB_ERRORS) break;
        const index = chunk.indexOf(failure.contactId);
        errors.push({
          row: offset + (index >= 0 ? index : 0) + 1,
          reason: failure.code,
        });
      }
      processed += chunk.length;
      await ctx.updateProgress(processed, ids.length);
    }
    throwIfBackgroundJobAborted(ctx.signal);
    await ctx.complete({
      label: `Imported ${added} seated + ${waitlisted} waitlisted (${skipped} already registered, ${errors.length} failed)`,
      progress: { current: processed, total: ids.length },
      errors,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      await ctx.fail("Workshop not found");
      return;
    }
    // Abort/deadline and real DB failures re-throw so BullMQ retries; the next run skips
    // contacts committed by this run.
    throw error;
  }
}

export function registerWorkshopImportJobRunner(): void {
  registerBackgroundJobRunner("workshops:import", runWorkshopParticipantImport);
}
