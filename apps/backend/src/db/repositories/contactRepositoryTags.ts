import { and, eq, inArray, isNull } from "drizzle-orm";
import { filterManualContactTags } from "@mms/shared";
import { contactTags, contacts } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";

export interface ContactTagUpdate {
  id: string;
  tags: string[];
}

/** Row/parameter batch size for tag writes (matches the child-hydration batching). */
const ID_BATCH_SIZE = 250;

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
    // Batch the id lists: `IN ($1..$n)` has a hard 65 535-parameter ceiling and a
    // large bulk-tag request must not turn into a database error.
    for (let index = 0; index < ids.length; index += ID_BATCH_SIZE) {
      const batch = ids.slice(index, index + ID_BATCH_SIZE);
      await tx.delete(contactTags).where(
        and(
          eq(contactTags.workspaceSubdomain, subdomain),
          inArray(contactTags.contactId, batch),
          // Bulk tagging owns manual tags only; module roles are system-managed.
          isNull(contactTags.source),
        ),
      );
    }

    const rows = normalized.flatMap((update) =>
      update.tags.map((name, index) => ({
        id: `tag-${index + 1}`,
        workspaceSubdomain: subdomain,
        contactId: update.id,
        name,
      })),
    );
    for (let index = 0; index < rows.length; index += ID_BATCH_SIZE) {
      await tx.insert(contactTags).values(rows.slice(index, index + ID_BATCH_SIZE));
    }

    for (let index = 0; index < ids.length; index += ID_BATCH_SIZE) {
      const batch = ids.slice(index, index + ID_BATCH_SIZE);
      await tx
        .update(contacts)
        .set({
          updatedAt: now,
          ...(updatedBy ? { updatedBy } : {}),
        })
        .where(and(eq(contacts.workspaceSubdomain, subdomain), inArray(contacts.id, batch)));
    }
  });

  await invalidateMultiTierCache({ tenantId: subdomain, domain: "contacts" });
  return ids.length;
}
