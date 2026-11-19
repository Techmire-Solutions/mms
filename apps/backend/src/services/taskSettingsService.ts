import { eq } from "drizzle-orm";
import { DEFAULT_TASK_SETTINGS, taskSettingsSchema, type TaskSettings } from "@mms/shared";
import { taskModulePreferences } from "../db/schema.js";
import { withTenant } from "../db/tenant-context.js";
import { getRequestTenant, getRequestUserId } from "../lib/tenantContext.js";
import { recordModernAuditEvent } from "./auditTrailService.js";

function tenantContext(): string {
  const tenant = getRequestTenant()?.trim().toLowerCase();
  if (!tenant) throw new Error("Tenant context required");
  return tenant;
}

async function loadTenantTaskSettings(tenant: string): Promise<TaskSettings> {
  return withTenant(tenant, async (tx) => {
    const [row] = await tx
      .select({
        delegationScope: taskModulePreferences.delegationScope,
        allowSelfAssignment: taskModulePreferences.allowSelfAssignment,
        notifyOnAssignment: taskModulePreferences.notifyOnAssignment,
        notifyOnStatusChange: taskModulePreferences.notifyOnStatusChange,
        notificationChannel: taskModulePreferences.notificationChannel,
      })
      .from(taskModulePreferences)
      .where(eq(taskModulePreferences.workspaceSubdomain, tenant));
    return row ? taskSettingsSchema.parse(row) : { ...DEFAULT_TASK_SETTINGS };
  });
}

export async function getTenantTaskSettings(): Promise<TaskSettings> {
  return loadTenantTaskSettings(tenantContext());
}

/** Explicit-subdomain variant for non-request contexts (e.g. the outbox worker). */
export async function getTenantTaskSettingsBySubdomain(subdomain: string): Promise<TaskSettings> {
  return loadTenantTaskSettings(subdomain.trim().toLowerCase());
}

export async function updateTenantTaskSettings(payload: unknown): Promise<TaskSettings> {
  const parsed = taskSettingsSchema.parse(payload);
  const tenant = tenantContext();
  return withTenant(tenant, async (tx) => {
    await tx
      .insert(taskModulePreferences)
      .values({ workspaceSubdomain: tenant, ...parsed })
      .onConflictDoUpdate({
        target: taskModulePreferences.workspaceSubdomain,
        set: { ...parsed, updatedAt: new Date() },
      });
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: tenant,
      tableName: "task_module_preferences",
      recordId: tenant,
      actionType: "UPDATE",
      realUserId: getRequestUserId(),
      newState: parsed,
    });
    return parsed;
  });
}
