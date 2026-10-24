import { sql } from "drizzle-orm";
import type {
  ContactChildMaps,
  RelationshipRow,
  ActivityRow,
  AttachmentRow,
  BankDetailRow,
} from "./contactRepositoryHydrateTypes.js";

export function buildRelationshipsAggSql(subdomain: string) {
  return sql`COALESCE((
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
  ), '[]'::json) AS relationships`;
}

export function buildActivitiesAggSql(subdomain: string) {
  return sql`COALESCE((
    SELECT json_agg(json_build_object(
      'id', act.id,
      'contactId', act.contact_id,
      'workspaceSubdomain', act.workspace_subdomain,
      'type', act.type,
      'content', act.content,
      'date', act.date,
      'by', act.by,
      'sortOrder', act.sort_order,
      'createdAt', act.created_at
    ) ORDER BY act.sort_order)
    FROM contact_activities act
    WHERE act.contact_id = c.id AND act.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS activities`;
}

export function buildAttachmentsAggSql(subdomain: string) {
  return sql`COALESCE((
    SELECT json_agg(json_build_object(
      'id', att.id,
      'contactId', att.contact_id,
      'workspaceSubdomain', att.workspace_subdomain,
      'name', att.name,
      'type', att.type,
      'size', att.size,
      'url', att.url,
      'date', att.date,
      'sortOrder', att.sort_order,
      'createdAt', att.created_at
    ) ORDER BY att.sort_order)
    FROM contact_attachments att
    WHERE att.contact_id = c.id AND att.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS attachments`;
}

export function buildBankDetailsAggSql(subdomain: string) {
  return sql`COALESCE((
    SELECT json_agg(json_build_object(
      'id', b.id,
      'contactId', b.contact_id,
      'workspaceSubdomain', b.workspace_subdomain,
      'bankName', b.bank_name,
      'accountTitle', b.account_title,
      'accountNumber', b.account_number,
      'sortOrder', b.sort_order,
      'createdAt', b.created_at
    ) ORDER BY b.sort_order)
    FROM contact_bank_details b
    WHERE b.contact_id = c.id AND b.workspace_subdomain = ${subdomain}
  ), '[]'::json) AS "bankDetails"`;
}

export function assignEngagementChildRows(
  result: ContactChildMaps,
  contactId: string,
  row: Record<string, unknown>,
) {
  if (Array.isArray(row.relationships))
    result.relationshipsMap.set(contactId, row.relationships as RelationshipRow[]);
  if (Array.isArray(row.activities))
    result.activitiesMap.set(contactId, row.activities as ActivityRow[]);
  if (Array.isArray(row.attachments))
    result.attachmentsMap.set(contactId, row.attachments as AttachmentRow[]);
  if (Array.isArray(row.bankDetails))
    result.bankDetailsMap.set(contactId, row.bankDetails as BankDetailRow[]);
}
