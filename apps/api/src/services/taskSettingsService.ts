import { eq } from "drizzle-orm";
import { DEFAULT_TASK_SETTINGS, taskSettingsSchema, type TaskSettings } from "@mms/contracts";
import { taskModulePreferences, workspaces } from "@mms/db/schema";
import { withTenant } from "@mms/db/context";
import { getRequestTenant, getRequestUserId } from "../lib/tenantContext.js";
import { recordModernAuditEvent } from "@mms/be-core/audit";

function tenantContext(): string {
  const tenant = getRequestTenant()?.trim().toLowerCase();
  if (!tenant) throw new Error("Tenant context required");
  return tenant;
}

/** Workspace IANA timezone (defaults to UTC when unset). */
export async function getWorkspaceTimezone(subdomain: string): Promise<string> {
  const tenant = subdomain.trim().toLowerCase();
  return withTenant(tenant, async (tx) => {
    const [row] = await tx
      .select({ timezone: workspaces.timezone })
      .from(workspaces)
      .where(eq(workspaces.subdomain, tenant));
    return row?.timezone?.trim() || "UTC";
  });
}

/** Workspace default language (defaults to "en" when unset). */
export async function getWorkspaceLanguage(subdomain: string): Promise<string> {
  const tenant = subdomain.trim().toLowerCase();
  return withTenant(tenant, async (tx) => {
    const [row] = await tx
      .select({ language: workspaces.language })
      .from(workspaces)
      .where(eq(workspaces.subdomain, tenant));
    return row?.language?.trim() || "en";
  });
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
