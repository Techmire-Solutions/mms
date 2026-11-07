import {
  findPromotionRun,
  updatePromotionRun,
} from "../db/repositories/sessionPromotionRepository.js";
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
  const run = await findPromotionRun(tenant, runId);
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
  await updatePromotionRun(tenant, runId, { status: "failed", error: error.slice(0, 1000) });
}
