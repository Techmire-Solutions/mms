import { sql } from "drizzle-orm";
import type {
  ContactChildMaps,
  PhoneRow,
  EmailRow,
  AddressRow,
  TagRow,
} from "./contactRepositoryHydrateTypes.js";

export function buildPhonesAggSql(subdomain: string) {
  return sql`COALESCE((
    SELECT json_agg(json_build_object(
      'id', p.id,
      'contactId', p.contact_id,
      'workspaceSubdomain', p.workspace_subdomain,
      'number', p.number,
      'label', p.label,
      'countryCode', p.country_code,
      'isPrimary', p.is_primary,
      'whatsappStatus', p.whatsapp_status,
      'sortOrder', p.sort_order,
      'createdAt', p.created_at
    ) ORDER BY p.sort_order)
    FROM contact_phones p
    WHERE p.contact_id = c.id AND p.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS phones`;
}

export function buildEmailsAggSql(subdomain: string) {
  return sql`COALESCE((
    SELECT json_agg(json_build_object(
      'id', e.id,
      'contactId', e.contact_id,
      'workspaceSubdomain', e.workspace_subdomain,
      'address', e.address,
      'label', e.label,
      'isPrimary', e.is_primary,
      'isVerified', e.is_verified,
      'sortOrder', e.sort_order,
      'createdAt', e.created_at
    ) ORDER BY e.sort_order)
    FROM contact_emails e
    WHERE e.contact_id = c.id AND e.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS emails`;
}

export function buildAddressesAggSql(subdomain: string) {
  return sql`COALESCE((
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
      'sortOrder', a.sort_order,
      'createdAt', a.created_at
    ) ORDER BY a.sort_order)
    FROM contact_addresses a
    WHERE a.contact_id = c.id AND a.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS addresses`;
}

export function buildTagsAggSql(subdomain: string) {
  return sql`COALESCE((
    SELECT json_agg(json_build_object(
      'id', t.id,
      'contactId', t.contact_id,
      'workspaceSubdomain', t.workspace_subdomain,
      'name', t.name,
      'createdAt', t.created_at
    ) ORDER BY t.created_at)
    FROM contact_tags t
    WHERE t.contact_id = c.id AND t.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS tags`;
}

export function assignPersonalChildRows(
  result: ContactChildMaps,
  contactId: string,
  row: Record<string, unknown>,
) {
  if (Array.isArray(row.phones)) result.phonesMap.set(contactId, row.phones as PhoneRow[]);
  if (Array.isArray(row.emails)) result.emailsMap.set(contactId, row.emails as EmailRow[]);
  if (Array.isArray(row.addresses))
    result.addressesMap.set(contactId, row.addresses as AddressRow[]);
  if (Array.isArray(row.tags)) result.tagsMap.set(contactId, row.tags as TagRow[]);
}
