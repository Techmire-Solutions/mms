import { randomBytes } from "node:crypto";
import type { UsersRepository } from "../repository/usersRepository.js";
import { getRequestTenant, requireTenant } from "../../lib/tenantContext.js";
import { withTenant } from "../../db/tenant-context.js";
import { defineTenantBulkCollectionService } from "../../services/tenantBulkService.js";
import { broadcastCollection } from "../../lib/livePush.js";
import {
  recordModernAuditEvent,
  mapActionStringToAuditType,
} from "../../services/auditTrailService.js";
import {
  type ActivityLog,
  activityLogListSchema,
  activityLogRecordSchema,
  dedupeTrimmedIds,
} from "@mms/shared";

export async function recordUserActivityLog(
  repo: UsersRepository,
  tenant: string,
  userId: string,
  action: ActivityLog["action"],
  detail: string,
  ip = "127.0.0.1",
): Promise<void> {
  const log: ActivityLog = {
    id: `log_${randomBytes(8).toString("hex")}`,
    userId,
    action,
    module: "users",
    detail,
    ts: new Date().toISOString(),
    ip,
  };
  // The activity row and its tamper-evident audit event share one tenant
  // transaction. The bridge used to be fire-and-forget (`.catch()`): a failed
  // append left the LOGIN/LOGOUT event out of the hash chain with only a log
  // line to show for it, and a tx-less append could fork the chain from genesis.
  await withTenant(tenant, async (tx) => {
    await repo.bulkSaveActivityLogs(tenant, [log]);
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: tenant,
      tableName: "users",
      recordId: userId,
      actionType: mapActionStringToAuditType(action),
      realUserId: userId,
      ipAddress: ip,
      newState: { action, detail, module: "users" },
    });
  });
  await broadcastCollection("user_activity_logs");
}

export function createUserActivityLogService(repo: UsersRepository) {
  const logService = defineTenantBulkCollectionService<ActivityLog>(
    {
      listByWorkspace: repo.listActivityLogsByWorkspace,
      replaceForWorkspace: repo.replaceActivityLogsForWorkspace,
    },
    activityLogListSchema,
    "user_activity_logs",
  );

  return {
    loadLogs: logService.load,

    loadLogById: async (id: string): Promise<ActivityLog | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findActivityLogById(tenant, cleanId);
    },

    loadLogsByIds: async (ids: string[]): Promise<ActivityLog[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findActivityLogsByIds(tenant, cleanIds);
    },

    saveLog: async (record: ActivityLog): Promise<void> => {
      const tenant = getRequestTenant();
      if (!tenant) return;
      const parsed = activityLogRecordSchema.parse(record);
      await repo.saveActivityLog(tenant, parsed);
      await broadcastCollection("user_activity_logs");
    },

    upsertLogs: async (records: ActivityLog[]): Promise<ActivityLog[]> => {
      const tenant = requireTenant();
      const parsed = activityLogListSchema.parse(records);
      await repo.bulkSaveActivityLogs(tenant, parsed);
      await broadcastCollection("user_activity_logs");
      return parsed;
    },
  };
}
