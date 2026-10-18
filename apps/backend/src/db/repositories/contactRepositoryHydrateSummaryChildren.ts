import { sql } from "drizzle-orm";
import {
  type Transaction,
  type ContactChildMaps,
  createEmptyContactChildMaps,
} from "./contactRepositoryHydrateTypes.js";

/**
 * Consolidated O(1) SQL query aggregating summary child collections via json_agg.
 */
export async function loadContactSummaryChildMapsAggregated(
  tx: Transaction,
  subdomain: string,
  contactIds: string[],
): Promise<ContactChildMaps> {
  if (contactIds.length === 0) {
    return createEmptyContactChildMaps();
  }

  const result = createEmptyContactChildMaps();

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
      ), '[]'::json) AS emails,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', a.id,
          'contactId', a.contact_id,
          'workspaceSubdomain', a.workspace_subdomain,
          'label', a.label,
          'line1', a.line1,
          'city', a.city,
          'state', a.state,
          'country', a.country,
          'isPrimary', a.is_primary,
          'sortOrder', a.sort_order
        ) ORDER BY a.sort_order)
        FROM contact_addresses a
        WHERE a.contact_id = c.id AND a.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS addresses,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', t.id,
          'contactId', t.contact_id,
          'workspaceSubdomain', t.workspace_subdomain,
          'name', t.name
        ) ORDER BY t.created_at)
        FROM contact_tags t
        WHERE t.contact_id = c.id AND t.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS tags,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', s.id,
          'contactId', s.contact_id,
          'workspaceSubdomain', s.workspace_subdomain,
          'platform', s.platform,
          'url', s.url,
          'sortOrder', s.sort_order
        ) ORDER BY s.sort_order)
        FROM contact_socials s
        WHERE s.contact_id = c.id AND s.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS socials,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', r.id,
          'contactId', r.contact_id,
          'workspaceSubdomain', r.workspace_subdomain,
          'relatedContactId', r.related_contact_id,
          'name', r.name,
          'relationship', r.relationship,
          'phone', r.phone,
          'inferred', r.inferred,
          'inferredFromContactId', r.inferred_from_contact_id,
          'inferenceDepth', r.inference_depth,
          'sortOrder', r.sort_order,
          'createdAt', r.created_at
        ) ORDER BY r.sort_order)
        FROM contact_relationships r
        WHERE r.contact_id = c.id AND r.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS relationships
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
    if (Array.isArray(row.phones)) result.phonesMap.set(contactId, row.phones);
    if (Array.isArray(row.emails)) result.emailsMap.set(contactId, row.emails);
    if (Array.isArray(row.addresses)) result.addressesMap.set(contactId, row.addresses);
    if (Array.isArray(row.tags)) result.tagsMap.set(contactId, row.tags);
    if (Array.isArray(row.socials)) result.socialsMap.set(contactId, row.socials);
    if (Array.isArray(row.relationships)) result.relationshipsMap.set(contactId, row.relationships);
  }

  return result;
}

/**
 * Lean child maps for contact directory listings (table/card views).
 * Queries only phones, emails, addresses, tags, socials, and relationships (6 queries instead of 12).
 */
export async function loadContactSummaryChildMaps(
  tx: Transaction,
  subdomain: string,
  contactIds: string[],
): Promise<ContactChildMaps> {
  if (contactIds.length === 0) {
    return createEmptyContactChildMaps();
  }

  const BATCH_SIZE = 250;
  if (contactIds.length > BATCH_SIZE) {
    const combined = createEmptyContactChildMaps();
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const slice = contactIds.slice(i, i + BATCH_SIZE);
      const partial = await loadContactSummaryChildMaps(tx, subdomain, slice);
      for (const [k, v] of partial.phonesMap) combined.phonesMap.set(k, v);
      for (const [k, v] of partial.emailsMap) combined.emailsMap.set(k, v);
      for (const [k, v] of partial.addressesMap) combined.addressesMap.set(k, v);
      for (const [k, v] of partial.tagsMap) combined.tagsMap.set(k, v);
      for (const [k, v] of partial.socialsMap) combined.socialsMap.set(k, v);
      for (const [k, v] of partial.relationshipsMap) combined.relationshipsMap.set(k, v);
    }
    return combined;
  }

  return loadContactSummaryChildMapsAggregated(tx, subdomain, contactIds);
}
