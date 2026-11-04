import { mapActionStringToAuditType } from "./auditState.js";
import { recordModernAuditEvent } from "../services/auditTrailService.js";

export interface CollectionAuditInput {
  tenant: string;
  /** Logical entity / table name recorded on the audit row (`contacts`, `students`, …). */
  tableName: string;
  recordId: string;
  /** Action string (e.g. `contact.create`) — mapped to the audit action type. */
  action: string;
  summary: string;
  realUserId?: string | null;
  oldState?: unknown;
  newState?: unknown;
  /** Person/record whose subject key encrypts the captured state. */
  subjectId?: string;
}

/**
 * Appends a per-record audit row from inside the domain write transaction.
 *
 * `recordModernAuditEvent` joins the active transaction (AsyncLocalStorage), so
 * the audit row commits or rolls back with the entity mutation
 * (`mms-data-layer` §5.4). Call this **inside** `runInTransaction`/`withTenant`
 * — the route layer must not append the authoritative row after commit.
 */
export async function appendCollectionAuditInTx(input: CollectionAuditInput): Promise<void> {
  await recordModernAuditEvent({
    workspaceSubdomain: input.tenant,
    tableName: input.tableName,
    recordId: input.recordId,
    actionType: mapActionStringToAuditType(input.action),
    realUserId: input.realUserId ?? null,
    oldState: input.oldState,
    newState: input.newState ?? { summary: input.summary, action: input.action },
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
  });
}
