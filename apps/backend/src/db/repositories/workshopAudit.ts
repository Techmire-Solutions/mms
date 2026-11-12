import type { AuditActionType } from "@mms/shared";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import type { TenantTransaction } from "../tenant-context.js";

/**
 * Workshop audit appends.
 *
 * Always called with the mutation's own transaction, so the audit row commits or rolls back with
 * the change it describes (no unlogged success, no audit row for a failed write). The actor, IP,
 * session and correlation id come from the request audit context bound by `authenticateTenant`;
 * `subjectId` ties participant state to the contact key so right-to-erasure can shred it without
 * breaking the hash chain.
 */
export async function auditRow(
  tx: TenantTransaction,
  input: {
    workspaceSubdomain: string;
    tableName: string;
    recordId: string;
    actionType: AuditActionType;
    oldState?: unknown;
    newState?: unknown;
    subjectId?: string;
    /** Override the delta capture (summary events keep their full old/new maps). */
    minimizeDelta?: boolean;
  },
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: input.workspaceSubdomain,
    tableName: input.tableName,
    recordId: input.recordId,
    actionType: input.actionType,
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    ...(input.oldState !== undefined ? { oldState: input.oldState } : {}),
    ...(input.newState !== undefined ? { newState: input.newState } : {}),
    // Updates store the changed-field delta; creates/removals keep the full row for evidence.
    minimizeDelta:
      input.minimizeDelta ?? (input.actionType === "UPDATE" && input.oldState !== undefined),
  });
}
