import type { TenantDatabaseSnapshot } from "@mms/contracts";
import { withTenant } from "@mms/db/context";
import { SYNC_REQUEST_TIMEOUT_MS } from "./syncLimits.js";
import { recordModernAuditEvent } from "../audit/index.js";
/**
 * Injected by the app (`apps/api/src/services/dbSyncRestoreAudit.ts`) so this
 * db-sync kernel module never imports an app service (P1c ports pattern).
 */
type RestoreDataSynchronizer = (
  payload: TenantDatabaseSnapshot,
  signal?: AbortSignal,
  fullRestore?: boolean,
) => Promise<void>;

let restoreDataSynchronizer: RestoreDataSynchronizer | null = null;

/** Register (or clear) the data synchronizer used by `restoreWorkspaceWithAudit`. */
export function configureRestoreDataSynchronizer(
  synchronizer: RestoreDataSynchronizer | null,
): void {
  restoreDataSynchronizer = synchronizer;
}

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

  if (!restoreDataSynchronizer) {
    throw new Error(
      "[dbSyncRestoreAudit] data synchronizer is not configured — import the app registration module first",
    );
  }
  const synchronizer = restoreDataSynchronizer;
  await withTenant(
    input.tenant,
    async () => {
      await synchronizer(input.payload, input.signal, true);
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
