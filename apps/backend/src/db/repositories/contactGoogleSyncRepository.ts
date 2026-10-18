import { and, eq } from "drizzle-orm";
import { contactGoogleSyncCredentials } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { encryptSecretAtRest, decryptSecretAtRest } from "../../lib/cryptoAtRest.js";

export interface ContactGoogleSyncCredentialRecord {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  updatedAt?: string;
}

type CredentialRow = typeof contactGoogleSyncCredentials.$inferSelect;

function toRecord(row: CredentialRow): ContactGoogleSyncCredentialRecord {
  const record: ContactGoogleSyncCredentialRecord = {};

  if (row.clientId) record.clientId = row.clientId;
  if (row.clientSecret) record.clientSecret = decryptSecretAtRest(row.clientSecret);
  if (row.accessToken) record.accessToken = decryptSecretAtRest(row.accessToken);
  if (row.refreshToken) record.refreshToken = decryptSecretAtRest(row.refreshToken);
  if (row.updatedAt) record.updatedAt = row.updatedAt.toISOString();

  return record;
}

export async function findContactGoogleSyncCredentials(
  workspaceSubdomain: string,
  userId: string,
): Promise<ContactGoogleSyncCredentialRecord> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  return withTenantRead(tenant, async (tx) => {
    const rows = await tx
      .select({
        workspaceSubdomain: contactGoogleSyncCredentials.workspaceSubdomain,
        userId: contactGoogleSyncCredentials.userId,
        clientId: contactGoogleSyncCredentials.clientId,
        clientSecret: contactGoogleSyncCredentials.clientSecret,
        accessToken: contactGoogleSyncCredentials.accessToken,
        refreshToken: contactGoogleSyncCredentials.refreshToken,
        updatedAt: contactGoogleSyncCredentials.updatedAt,
      })
      .from(contactGoogleSyncCredentials)
      .where(
        and(
          eq(contactGoogleSyncCredentials.workspaceSubdomain, tenant),
          eq(contactGoogleSyncCredentials.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : {};
  });
}

export async function upsertContactGoogleSyncCredentials(
  workspaceSubdomain: string,
  userId: string,
  config: ContactGoogleSyncCredentialRecord,
): Promise<ContactGoogleSyncCredentialRecord> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  const now = new Date();
  const values = {
    workspaceSubdomain: tenant,
    userId,
    clientId: config.clientId ?? null,
    clientSecret: encryptSecretAtRest(config.clientSecret) ?? null,
    accessToken: encryptSecretAtRest(config.accessToken) ?? null,
    refreshToken: encryptSecretAtRest(config.refreshToken) ?? null,
    updatedAt: now,
  };

  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .insert(contactGoogleSyncCredentials)
      .values(values)
      .onConflictDoUpdate({
        target: [
          contactGoogleSyncCredentials.workspaceSubdomain,
          contactGoogleSyncCredentials.userId,
        ],
        set: {
          clientId: values.clientId,
          clientSecret: values.clientSecret,
          accessToken: values.accessToken,
          refreshToken: values.refreshToken,
          updatedAt: now,
        },
      })
      .returning();
    return toRecord(rows[0]!);
  });
}

export async function deleteContactGoogleSyncCredentials(
  workspaceSubdomain: string,
  userId: string,
): Promise<void> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  await withTenant(tenant, async (tx) => {
    await tx
      .delete(contactGoogleSyncCredentials)
      .where(
        and(
          eq(contactGoogleSyncCredentials.workspaceSubdomain, tenant),
          eq(contactGoogleSyncCredentials.userId, userId),
        ),
      );
  });
}

/** Admin/migration: replace every credential row for a workspace. */
export async function replaceContactGoogleSyncCredentialsForWorkspace(
  workspaceSubdomain: string,
  entries: Array<{ userId: string } & ContactGoogleSyncCredentialRecord>,
): Promise<void> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  await withTenant(tenant, async (tx) => {
    await tx
      .delete(contactGoogleSyncCredentials)
      .where(eq(contactGoogleSyncCredentials.workspaceSubdomain, tenant));
    if (entries.length === 0) return;
    const now = new Date();
    await tx.insert(contactGoogleSyncCredentials).values(
      entries.map((entry) => ({
        workspaceSubdomain: tenant,
        userId: entry.userId,
        clientId: entry.clientId ?? null,
        clientSecret: encryptSecretAtRest(entry.clientSecret) ?? null,
        accessToken: encryptSecretAtRest(entry.accessToken) ?? null,
        refreshToken: encryptSecretAtRest(entry.refreshToken) ?? null,
        updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : now,
      })),
    );
  });
}
