import { and, eq, inArray, isNull } from "drizzle-orm";
import { filterManualContactTags } from "@mms/shared";
import { contactTags, contacts } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";

export interface ContactTagUpdate {
  id: string;
  tags: string[];
}

/** Case-insensitive de-duplication that preserves the first observed casing. */
function normalizeTagNames(tags: string[]): string[] {
  return filterManualContactTags(tags);
}

/**
 * Tag-only bulk write (no child-table rewrite).
 *
 * Rewriting the whole hydrated contact from `bulkSave` deleted and re-inserted
 * every child row from a pre-lock snapshot, so a concurrent phone/email edit
 * could be reverted by a tag change (C-03). This touches `contact_tags` plus the
 * parent `updated_at`/`updated_by` only.
 */
export async function replaceContactTags(
  tenant: string,
  updates: ContactTagUpdate[],
  updatedBy?: string,
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const normalized = updates
    .map((update) => ({
      id: String(update.id ?? "").trim(),
      tags: normalizeTagNames(update.tags ?? []),
    }))
    .filter((update) => update.id.length > 0);
  if (normalized.length === 0) return 0;

  const ids = normalized.map((update) => update.id);
  const now = new Date();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(contactTags).where(
      and(
        eq(contactTags.workspaceSubdomain, subdomain),
        inArray(contactTags.contactId, ids),
        // Bulk tagging owns manual tags only; module roles are system-managed.
        isNull(contactTags.source),
      ),
    );

    const rows = normalized.flatMap((update) =>
      update.tags.map((name, index) => ({
        id: `tag-${index + 1}`,
        workspaceSubdomain: subdomain,
        contactId: update.id,
        name,
      })),
    );
    if (rows.length > 0) {
      await tx.insert(contactTags).values(rows);
    }

    await tx
      .update(contacts)
      .set({
        updatedAt: now,
        ...(updatedBy ? { updatedBy } : {}),
      })
      .where(and(eq(contacts.workspaceSubdomain, subdomain), inArray(contacts.id, ids)));
  });

  await invalidateMultiTierCache({ tenantId: subdomain, domain: "contacts" });
  return ids.length;
}
