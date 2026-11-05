import { and, eq, inArray, or, sql } from "drizzle-orm";
import { hydrateContactRelationshipFields, type Contact } from "@mms/shared";
import { contactAttachments, contacts } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import {
  countContactsByWorkspace,
  findContactById,
  findContactsByIds,
  listContactsByWorkspace,
} from "./contactRepositoryHydrate.js";
import { syncContactChildrenTx } from "./contactRepositoryPersistChildren.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import {
  type ContactInsert,
  contactWriteValues,
  contactUpdateSetValues,
} from "./contactRepositoryValues.js";
import {
  bulkSoftDeleteContactsSql,
  bulkRestoreContactsSql,
} from "./contactRepositorySoftDelete.js";
import { bulkSaveContacts, replaceContactsForWorkspace } from "./contactRepositoryBulkSave.js";

export {
  type ContactInsert,
  contactWriteValues,
  contactUpdateSetValues,
  bulkSoftDeleteContactsSql,
  bulkRestoreContactsSql,
  bulkSaveContacts,
  replaceContactsForWorkspace,
};

type Transaction = TenantTransaction;

/**
 * Upserts the parent row + child graph and returns the row's stored `updated_at`.
 *
 * The returned token is the OCC version the client must send back; it comes from
 * the database write, never from the pre-write record.
 */
export async function persistContactTx(
  tx: Transaction,
  subdomain: string,
  rawContact: Contact,
): Promise<string> {
  const contact = hydrateContactRelationshipFields(rawContact);

  const rows = await tx
    .insert(contacts)
    .values(contactWriteValues(subdomain, contact))
    .onConflictDoUpdate({
      target: [contacts.workspaceSubdomain, contacts.id],
      set: contactUpdateSetValues(subdomain, contact),
    })
    .returning({ updatedAt: contacts.updatedAt });

  await syncContactChildrenTx(tx, subdomain, String(contact.id), contact);
  return rows[0]!.updatedAt.toISOString();
}

/** Latest contact write time (or null), used to detect writes during duplicate scans (C-02). */
export async function getLatestContactWriteAt(tenant: string): Promise<string | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({ latest: sql<string | null>`max(${contacts.updatedAt})::text` })
      .from(contacts)
      .where(eq(contacts.workspaceSubdomain, subdomain));
    return row?.latest ?? null;
  });
}

export async function saveContact(tenant: string, contact: Contact): Promise<string> {
  const subdomain = tenant.trim().toLowerCase();
  const updatedAt = await withTenant(subdomain, async (tx) =>
    persistContactTx(tx, subdomain, contact),
  );
  await invalidateMultiTierCache({
    tenantId: subdomain,
    domain: "contacts",
    key: String(contact.id),
  });
  return updatedAt;
}

/**
 * Formats a `Date` as the wall-clock string node-postgres writes into a naive
 * `timestamp` column (same fields `toISOString()` would show in local time).
 */
function toNaiveTimestamp(date: Date): string {
  const pad = (value: number, width = 2): string => String(value).padStart(width, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/**
 * Conditional save for optimistic concurrency (`mms-api-interface` §6).
 *
 * The version predicate is part of the `UPDATE` — not a preceding read — so a
 * competing writer that commits between our read and our write leaves zero
 * matching rows instead of being silently overwritten.
 *
 * The comparison accepts either stored representation: `contacts.updated_at` is
 * declared `timestamp with time zone`, but some deployments still carry the
 * legacy naive column, where node-postgres keeps the writer's wall clock. The
 * naive branch matches that value directly; the timestamptz branch matches the
 * instant. Both are millisecond-truncated because the client token round-trips
 * through a JS `Date`.
 *
 * Returns `null` for both a stale version and a concurrently deleted row, or the
 * row's new `updated_at` on success; the caller maps `null` to 409 (the client's
 * view is stale either way).
 */
export async function saveContactIfVersionMatches(
  tenant: string,
  rawContact: Contact,
  expectedUpdatedAt: string,
): Promise<string | null> {
  const subdomain = tenant.trim().toLowerCase();
  const contact = hydrateContactRelationshipFields(rawContact);
  const expected = new Date(expectedUpdatedAt);
  const naiveExpected = toNaiveTimestamp(expected);
  const savedUpdatedAt = await withTenant(subdomain, async (tx) => {
    const rows = await tx
      .update(contacts)
      .set(contactUpdateSetValues(subdomain, contact))
      .where(
        and(
          eq(contacts.workspaceSubdomain, subdomain),
          eq(contacts.id, String(contact.id)),
          or(
            sql`date_trunc('milliseconds', ${contacts.updatedAt}) = ${naiveExpected}::timestamp`,
            sql`date_trunc('milliseconds', ${contacts.updatedAt}) = ${expected}::timestamptz`,
          ),
        ),
      )
      .returning({ updatedAt: contacts.updatedAt });
    if (rows.length === 0) return null;
    await syncContactChildrenTx(tx, subdomain, String(contact.id), contact);
    return rows[0]!.updatedAt.toISOString();
  });
  if (savedUpdatedAt) {
    await invalidateMultiTierCache({
      tenantId: subdomain,
      domain: "contacts",
      key: String(contact.id),
    });
  }
  return savedUpdatedAt;
}

/** True when any contact attachment row still stores this URL (or its relative form). */
export async function isContactAttachmentReferenced(
  subdomain: string,
  url: string,
  alternateUrl?: string | null,
): Promise<boolean> {
  const candidates = new Set<string>([url]);
  if (alternateUrl) candidates.add(alternateUrl);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: contactAttachments.id })
      .from(contactAttachments)
      .where(
        and(
          eq(contactAttachments.workspaceSubdomain, subdomain),
          inArray(contactAttachments.url, [...candidates]),
        ),
      )
      .limit(1);
    return rows.length > 0;
  });
}

export const contactRepo = {
  listByWorkspace: listContactsByWorkspace,
  countByWorkspace: countContactsByWorkspace,
  getLatestWriteAt: getLatestContactWriteAt,
  findById: findContactById,
  findByIds: findContactsByIds,
  save: saveContact,
  bulkSave: bulkSaveContacts,
  bulkSoftDelete: bulkSoftDeleteContactsSql,
  bulkRestore: bulkRestoreContactsSql,
  replaceForWorkspace: replaceContactsForWorkspace,
  isAttachmentReferenced: isContactAttachmentReferenced,
};
