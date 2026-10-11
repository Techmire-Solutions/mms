import { randomBytes } from "node:crypto";
import type { UsersRepository } from "../repository/usersRepository.js";
import { getRequestTenant, requireTenant } from "../../lib/tenantContext.js";
import { defineTenantBulkCollectionService } from "../../services/tenantBulkService.js";
import { broadcastCollection } from "../../services/websocketService.js";
import {
  recordModernAuditEvent,
  mapActionStringToAuditType,
} from "../../services/auditTrailService.js";
import { logger } from "../../lib/logger.js";
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
  await repo.bulkSaveActivityLogs(tenant, [log]);
  await broadcastCollection("user_activity_logs");

  // Bridge: also emit to tamper-evident audit_trail_events so LOGIN/LOGOUT/session
  // events appear in the 5-dimension chain (action_type LOGIN). Non-blocking.
  recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "users",
    recordId: userId,
    actionType: mapActionStringToAuditType(action),
    realUserId: userId,
    ipAddress: ip,
    newState: { action, detail, module: "users" },
  }).catch((err: unknown) =>
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "audit_trail_events bridge failed for user activity log",
    ),
  );
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
