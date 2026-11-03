import {
  resolveContactFieldConfigSnapshot,
  stripUnreadableViewerWriteKeys,
  type Contact,
  type FieldConfig,
} from "@mms/shared";

/**
 * Write-side mirror of the read sanitizer: drops patch keys the acting role
 * cannot read.
 *
 * A role that cannot read a tab receives the contact without that collection, so
 * its form save would send `[]` and clear rows it never saw (`mms-fields` §4).
 * Enforcing the same strip plan on the write path makes the server authoritative
 * instead of trusting the client to omit unseen keys.
 *
 * Returns the patch untouched when no viewer role is known (server-side batch
 * writers) or when the tenant has no tab/field restrictions — the default
 * configuration strips nothing.
 */
export function stripUnreadableContactWriteKeys<T extends Partial<Contact>>(
  patch: T,
  viewerRole: string | null | undefined,
  fieldConfig: FieldConfig | null | undefined,
): T {
  if (!viewerRole) return patch;
  const snapshot = resolveContactFieldConfigSnapshot(fieldConfig ?? null);
  return stripUnreadableViewerWriteKeys(patch, viewerRole, snapshot);
}
