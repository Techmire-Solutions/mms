import { sql } from "drizzle-orm";
import type { Contact } from "@mms/shared";
import type { contactEmails, contactPhones, contacts } from "../schema.js";
import type { Transaction } from "./contactRepositoryHydrateTypes.js";
import { contactRowToRecord } from "./contactRepositoryMappers.js";

type ContactRow = typeof contacts.$inferSelect;
type PhoneRow = typeof contactPhones.$inferSelect;
type EmailRow = typeof contactEmails.$inferSelect;

/**
 * Recipient-only child aggregation: phones and emails in one query.
 *
 * The messaging recipient picker needs a name plus a reachable phone/email and
 * nothing else, so the directory's six-collection summary hydrate is wasted work
 * (A-03). This deliberately omits addresses/socials/tags/relationships.
 */
export async function loadContactRecipientChildMaps(
  tx: Transaction,
  subdomain: string,
  contactIds: string[],
): Promise<{ phones: Map<string, PhoneRow[]>; emails: Map<string, EmailRow[]> }> {
  const phones = new Map<string, PhoneRow[]>();
  const emails = new Map<string, EmailRow[]>();
  if (contactIds.length === 0) return { phones, emails };

  const queryResult = await tx.execute(sql`
    SELECT
      c.id AS "contactId",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', p.id,
          'contactId', p.contact_id,
          'workspaceSubdomain', p.workspace_subdomain,
          'number', p.number,
          'label', p.label,
          'countryCode', p.country_code,
          'isPrimary', p.is_primary,
          'whatsappStatus', p.whatsapp_status,
          'sortOrder', p.sort_order
        ) ORDER BY p.sort_order)
        FROM contact_phones p
        WHERE p.contact_id = c.id AND p.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS phones,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', e.id,
          'contactId', e.contact_id,
          'workspaceSubdomain', e.workspace_subdomain,
          'address', e.address,
          'label', e.label,
          'isPrimary', e.is_primary,
          'isVerified', e.is_verified,
          'sortOrder', e.sort_order
        ) ORDER BY e.sort_order)
        FROM contact_emails e
        WHERE e.contact_id = c.id AND e.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS emails
    FROM (VALUES ${sql.join(
      contactIds.map((id) => sql`(${id}::text)`),
      sql`, `,
    )}) AS c(id)
  `);

  const rows = (
    Array.isArray(queryResult)
      ? queryResult
      : ((queryResult as { rows?: Record<string, unknown>[] })?.rows ?? [])
  ) as Record<string, unknown>[];

  for (const row of rows) {
    const contactId = String(row.contactId);
    if (Array.isArray(row.phones)) phones.set(contactId, row.phones);
    if (Array.isArray(row.emails)) emails.set(contactId, row.emails);
  }

  return { phones, emails };
}

/** Hydrates a page of contacts with names/phones/emails only (messaging recipients). */
export async function hydrateContactsRecipientList(
  tx: Transaction,
  subdomain: string,
  contactRows: ContactRow[],
): Promise<Contact[]> {
  if (contactRows.length === 0) return [];
  const contactIds = contactRows.map((row) => row.id);
  const childMaps = await loadContactRecipientChildMaps(tx, subdomain, contactIds);

  return contactRows.map((row) =>
    contactRowToRecord(row, childMaps.phones.get(row.id) ?? [], childMaps.emails.get(row.id) ?? []),
  );
}
