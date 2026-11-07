import { sessionRolloverRepository } from "../sessions/repository/sessionRolloverRepositoryAdapter.js";
import { recordModernAuditEvent } from "./auditTrailService.js";

/**
 * Terminal reconciliation for a rollover run whose background job exhausted its retries.
 * Guarantees the run is not left `running` (which would silently block future rollovers) and
 * records why it was abandoned. Partial targets are intentionally kept for inspection/resume;
 * deterministic ids make a manual retry idempotent.
 */
export async function failPromotionRunFromDlq(
  tenant: string,
  runId: string,
  error: string,
): Promise<void> {
  const run = await sessionRolloverRepository.findPromotionRun(tenant, runId);
  if (!run || run.status === "completed" || run.status === "failed") return;
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "session_promotion_runs",
    recordId: runId,
    actionType: "UPDATE",
    oldState: { status: run.status },
    newState: {
      status: "failed",
      operation: "rollover_dead_lettered",
      error: error.slice(0, 1000),
    },
  });
  await sessionRolloverRepository.updatePromotionRun(tenant, runId, {
    status: "failed",
    error: error.slice(0, 1000),
  });
}

/**
 * Re-opens a terminally failed run for the dead-letter replay path. The same run id (and therefore
 * the same deterministic artefact ids and partially populated target) is reused.
 */
export async function resumePromotionRunForReplay(
  tenant: string,
  runId: string,
  actorId?: string | null,
  reason = "Dead-letter replay",
): Promise<boolean> {
  const run = await sessionRolloverRepository.findPromotionRun(tenant, runId);
  if (!run || run.status !== "failed") return false;
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "session_promotion_runs",
    recordId: runId,
    actionType: "UPDATE",
    realUserId: actorId ?? undefined,
    oldState: { status: "failed", error: run.error ?? null },
    newState: { status: "queued", operation: "rollover_replay", reason },
  });
  await sessionRolloverRepository.updatePromotionRun(tenant, runId, {
    status: "queued",
    error: null,
  });
  return true;
}
