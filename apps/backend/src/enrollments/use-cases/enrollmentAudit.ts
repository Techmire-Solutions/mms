import type { EnrollmentAuditReasonCode, User } from "@mms/shared";
import type { TenantTransaction } from "../../db/tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

export { ENROLLMENT_AUDIT_REASON_CODES, type EnrollmentAuditReasonCode } from "@mms/shared";

export interface EnrollmentAuditInput {
  recordId: string;
  actionType: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
  reasonCode: EnrollmentAuditReasonCode;
  oldState?: unknown;
  newState?: unknown;
  actor?: Pick<User, "id"> | { userId?: string | null } | null;
}

/**
 * Writes one immutable enrollment audit row **inside the mutation transaction**. Requires an
 * ambient transaction on purpose: a post-commit audit can be lost when the follow-up write
 * fails, which is exactly the gap this closes.
 */
export async function recordEnrollmentAudit(
  tx: TenantTransaction,
  tenant: string,
  input: EnrollmentAuditInput,
): Promise<void> {
  const actorId =
    input.actor && "id" in input.actor && input.actor.id
      ? String(input.actor.id)
      : input.actor && "userId" in input.actor && input.actor.userId
        ? String(input.actor.userId)
        : undefined;
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: tenant,
    tableName: "enrollments",
    recordId: input.recordId,
    actionType: input.actionType,
    realUserId: actorId,
    oldState: input.oldState,
    newState: { reasonCode: input.reasonCode, ...(input.newState as object | undefined) },
  });
}

/** Only the fields that actually changed, so the immutable diff stays small and PII-free. */
export function changedEnrollmentFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): { oldState: Record<string, unknown>; newState: Record<string, unknown> } {
  const oldState: Record<string, unknown> = {};
  const newState: Record<string, unknown> = {};
  for (const field of fields) {
    const oldValue = before[field];
    const newValue = after[field];
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    oldState[field] = oldValue;
    newState[field] = newValue;
  }
  return { oldState, newState };
}
