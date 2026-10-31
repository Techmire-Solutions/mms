import type { TenantDatabaseSnapshot } from "@mms/shared";
import { withTenant } from "../db/tenant-context.js";
import { SYNC_REQUEST_TIMEOUT_MS } from "../lib/syncLimits.js";
import { recordModernAuditEvent } from "./auditTrailService.js";
import { synchronizeData } from "./dbSyncService.js";

export interface RestoreWorkspaceInput {
  tenant: string;
  payload: TenantDatabaseSnapshot;
  signal?: AbortSignal;
  actorUserId: string;
}

/**
 * Whole-workspace restore + its RESTORE audit row in one transaction.
 *
 * `synchronizeData` reuses the active tenant transaction, so an audit failure
 * (or process death after commit) cannot leave a restore without its audit row.
 */
export async function restoreWorkspaceWithAudit(input: RestoreWorkspaceInput): Promise<void> {
  const collections = Object.keys(input.payload.collections ?? {}).length;
  const objects = Object.keys(input.payload.objects ?? {}).length;

  await withTenant(
    input.tenant,
    async () => {
      await synchronizeData(input.payload, input.signal, true);
      await recordModernAuditEvent({
        workspaceSubdomain: input.tenant,
        tableName: "sync",
        recordId: "sync",
        actionType: "RESTORE",
        realUserId: input.actorUserId,
        newState: {
          summary: `Restored workspace backup with ${collections} collections and ${objects} objects`,
        },
      });
    },
    { statementTimeoutMs: SYNC_REQUEST_TIMEOUT_MS },
  );
}
