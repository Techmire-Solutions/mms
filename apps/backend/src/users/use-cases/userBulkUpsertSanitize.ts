import type { WorkspaceUser } from "@mms/shared";

/**
 * Editable profile fields a bulk upsert may carry. Credential, lifecycle, tenant
 * and derived-auth fields are intentionally excluded so a bulk payload can never
 * reset a password, flip soft-delete state, or pivot to another workspace.
 */
const BULK_EDITABLE_USER_FIELDS = [
  "name",
  "email",
  "phone",
  "contactId",
  "role",
  "status",
  "twoFactorEnabled",
] as const;

/** Strips a bulk-upsert row to the allowlist of client-editable fields. */
export function sanitizeBulkUserRow(
  update: WorkspaceUser & Record<string, unknown>,
): WorkspaceUser {
  const row: Record<string, unknown> = { id: update.id };
  for (const key of BULK_EDITABLE_USER_FIELDS) {
    if (update[key] !== undefined) row[key] = update[key];
  }
  return row as WorkspaceUser;
}
