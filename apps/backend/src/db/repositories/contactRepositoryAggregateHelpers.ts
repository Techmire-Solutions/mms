import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { isContactLockedEnabledTab, type FieldConfig } from "@mms/shared";
import {
  contacts,
  contactPhones,
  contactEmails,
  contactAddresses,
  contactSocials,
  contactRelationships,
} from "../schema.js";
import { contactFieldNonEmptySql } from "./contactRepositorySql.js";

const COMPLETENESS_SKIP_TYPES = new Set(["boolean", "ai_summary"]);
const CONTACT_LIST_TAB_KEYS_SET = new Set([
  "phones",
  "emails",
  "addresses",
  "socials",
  "relationship",
]);

export function activeWorkspaceWhere(subdomain: string): SQL {
  return and(eq(contacts.workspaceSubdomain, subdomain), isNull(contacts.deletedAt))!;
}

export function createdAtRawSql(): SQL {
  return sql`${contacts.createdAt}::text`;
}

function listTabHasRecordsSql(tabKey: string): SQL {
  switch (tabKey) {
    case "phones":
      return sql`EXISTS (SELECT 1 FROM ${contactPhones} p WHERE p.workspace_subdomain = ${contacts.workspaceSubdomain} AND p.contact_id = ${contacts.id})`;
    case "emails":
      return sql`EXISTS (SELECT 1 FROM ${contactEmails} e WHERE e.workspace_subdomain = ${contacts.workspaceSubdomain} AND e.contact_id = ${contacts.id})`;
    case "addresses":
      return sql`EXISTS (SELECT 1 FROM ${contactAddresses} a WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain} AND a.contact_id = ${contacts.id})`;
    case "socials":
      return sql`EXISTS (SELECT 1 FROM ${contactSocials} s WHERE s.workspace_subdomain = ${contacts.workspaceSubdomain} AND s.contact_id = ${contacts.id})`;
    case "relationship":
      return sql`EXISTS (SELECT 1 FROM ${contactRelationships} r WHERE r.workspace_subdomain = ${contacts.workspaceSubdomain} AND r.contact_id = ${contacts.id})`;
    default:
      return sql`true`;
  }
}

/** True when required Setup fields/tabs are missing (SQL mirror of JS profile-completeness semantics). */
export function buildProfileIncompleteSql(fieldConfig: FieldConfig): SQL | null {
  const fields = fieldConfig.fields || {};
  const formTabs = (fieldConfig.formTabs || []).filter(
    (tab) => tab.enabled !== false || isContactLockedEnabledTab(tab.key),
  );
  const requiredTabs = new Set(fieldConfig.requiredTabs || []);
  const missingClauses: SQL[] = [];

  for (const tab of formTabs) {
    if (CONTACT_LIST_TAB_KEYS_SET.has(tab.key)) {
      if (!requiredTabs.has(tab.key)) continue;
      missingClauses.push(sql`(NOT ${listTabHasRecordsSql(tab.key)})`);
      continue;
    }
    const tabFields = (fields[tab.key] || []).filter(
      (field) => field.enabled && !COMPLETENESS_SKIP_TYPES.has(field.type) && field.required,
    );
    for (const field of tabFields) {
      missingClauses.push(sql`(NOT ${contactFieldNonEmptySql(field.key)})`);
    }
  }

  if (missingClauses.length === 0) return null;
  return sql`(${sql.join(missingClauses, sql` OR `)})`;
}
