import { eq } from "drizzle-orm";
import { userUiPreferences, tenantUsers } from "../schema.js";
import { withTenant } from "../tenant-context.js";

export interface UserUiPreferenceRecord {
  userId: string;
  state: Record<string, unknown>;
  updatedAt?: string;
}

export async function listAllUserUiPreferencesByWorkspace(
  tenant: string,
): Promise<UserUiPreferenceRecord[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        userId: userUiPreferences.userId,
        state: userUiPreferences.state,
        updatedAt: userUiPreferences.updatedAt,
      })
      .from(userUiPreferences)
      .where(eq(userUiPreferences.workspaceSubdomain, subdomain));

    return rows.map((row) => ({
      userId: row.userId,
      state: (row.state ?? {}) as Record<string, unknown>,
      updatedAt: row.updatedAt.toISOString(),
    }));
  });
}

export async function replaceUserUiPreferencesForWorkspace(
  tenant: string,
  records: UserUiPreferenceRecord[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(userUiPreferences).where(eq(userUiPreferences.workspaceSubdomain, subdomain));

    if (!Array.isArray(records) || records.length === 0) return;

    // Fetch existing users in the workspace to prevent foreign key errors on orphaned state
    const existingUsers = await tx
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(eq(tenantUsers.workspaceSubdomain, subdomain));

    const validUserIds = new Set(existingUsers.map((u) => u.id));

    const validRecords: (typeof userUiPreferences.$inferInsert)[] = [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (
        record &&
        typeof record === "object" &&
        record.userId &&
        validUserIds.has(record.userId)
      ) {
        validRecords.push({
          workspaceSubdomain: subdomain,
          userId: record.userId,
          state: record.state ?? {},
          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date(),
        });
      }
    }

    if (validRecords.length > 0) {
      await tx.insert(userUiPreferences).values(validRecords);
    }
  });
}
