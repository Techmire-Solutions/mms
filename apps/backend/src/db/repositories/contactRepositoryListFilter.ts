import { eq, inArray, isNotNull, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import { CONTACT_SORT_FIELDS, isQueryFlagTrue, type ContactsListQuery } from "@mms/shared";
import { contacts, contactAddresses, contactTags } from "../schema.js";
import { hasEmailSql, hasPhoneSql, hasWhatsAppSql } from "./contactRepositorySql.js";
import {
  existsActiveStudentLinkSql,
  existsActiveFacultyLinkSql,
  existsActiveStaffLinkSql,
} from "./contactRepositoryLinkSql.js";
import { isSyedSql, buildSearchSql } from "./contactRepositoryListSql.js";

/** First address value by primary flag then sort order (matches the Work address cell). */
function primaryAddressSql(column: "line1" | "city" | "state" | "country"): SQL {
  return sql`(
      SELECT a.${sql.raw(column)} FROM ${contactAddresses} a
      WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain}
        AND a.contact_id = ${contacts.id}
      ORDER BY CASE WHEN a.is_primary THEN 0 ELSE 1 END, a.sort_order ASC
      LIMIT 1
    )`;
}

/** Alphabetically first active tag (the Tag column shows the tag chips in name order). */
function firstTagSql(): SQL {
  return sql`(
      SELECT min(lower(t.name)) FROM ${contactTags} t
      WHERE t.workspace_subdomain = ${contacts.workspaceSubdomain}
        AND t.contact_id = ${contacts.id}
        AND t.archived = false
    )`;
}

/** Sort expression per supported key; `nullable` keeps empty values last in both directions. */
function sortExpression(field: string): { expression: SQL; nullable: boolean } | undefined {
  switch (field) {
    case "name":
      return { expression: sql`${contacts.name}`, nullable: false };
    case "firstName":
      return { expression: sql`${contacts.firstName}`, nullable: false };
    case "lastName":
      return { expression: sql`${contacts.lastName}`, nullable: true };
    case "createdAt":
      return { expression: sql`${contacts.createdAt}`, nullable: false };
    case "updatedAt":
      return { expression: sql`${contacts.updatedAt}`, nullable: false };
    case "isSyed":
      return { expression: sql`${contacts.isSyed}`, nullable: false };
    case "gender":
      return { expression: sql`NULLIF(lower(btrim(${contacts.gender})), '')`, nullable: true };
    case "cnic":
      return { expression: sql`NULLIF(btrim(${contacts.cnic}), '')`, nullable: true };
    case "dob":
      return { expression: sql`${contacts.dob}`, nullable: true };
    case "tag":
      return { expression: firstTagSql(), nullable: true };
    case "line1":
    case "city":
    case "state":
    case "country":
      return { expression: sql`NULLIF(btrim(${primaryAddressSql(field)}), '')`, nullable: true };
    default:
      return undefined;
  }
}

export function buildOrderBy(
  sortField: string | undefined,
  sortDir: "asc" | "desc" | "" | undefined,
): SQL {
  const field = sortField?.trim();
  const resolved = field && CONTACT_SORT_FIELDS.has(field) ? sortExpression(field) : undefined;
  if (!resolved) return sql`${contacts.id} asc`;
  const dir = sortDir === "desc" ? sql.raw("desc") : sql.raw("asc");
  const nulls = resolved.nullable ? sql.raw(" nulls last") : sql.raw("");
  // Deterministic tiebreaker: SQL does not guarantee a stable order for rows
  // with equal sort keys, so page-walking exports could skip or repeat rows
  // across OFFSET pages without one.
  return sql`${resolved.expression} ${dir}${nulls}, ${contacts.id} asc`;
}

export function buildListConditions(
  subdomain: string,
  query: ContactsListQuery,
  excludeIds: string[],
  includeIds: string[] | undefined,
): SQL[] {
  const conditions: SQL[] = [eq(contacts.workspaceSubdomain, subdomain)];

  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(contacts.deletedAt));
  } else {
    conditions.push(isNull(contacts.deletedAt));
  }

  if (query.gender?.trim()) {
    const genderFilter = query.gender.trim().toLowerCase();
    if (genderFilter === "unspecified") {
      conditions.push(sql`(
        NULLIF(trim(lower(COALESCE(${contacts.gender}, ''))), '') IS NULL
        OR lower(trim(${contacts.gender})) = 'unspecified'
      )`);
    } else {
      conditions.push(sql`lower(trim(COALESCE(${contacts.gender}, ''))) = ${genderFilter}`);
    }
  }

  if (query.hasPhone) {
    conditions.push(hasPhoneSql());
  }
  if (query.hasEmail) {
    conditions.push(hasEmailSql());
  }
  if (query.hasReachable) {
    conditions.push(sql`(${hasPhoneSql()} OR ${hasEmailSql()})`);
  }

  const quick = query.quickFilter;
  if (quick && quick !== "all") {
    if (quick === "whatsapp") conditions.push(hasWhatsAppSql());
    else if (quick === "syed") conditions.push(isSyedSql());
    else if (quick === "missingInfo") {
      conditions.push(sql`(NOT ${hasPhoneSql()} OR NOT ${hasEmailSql()})`);
    } else if (quick === "recent") {
      conditions.push(sql`${contacts.createdAt} >= (NOW() - INTERVAL '30 days')`);
    }
  }

  if (excludeIds.length > 0) {
    conditions.push(notInArray(contacts.id, excludeIds));
  }
  if (includeIds && includeIds.length > 0) {
    conditions.push(inArray(contacts.id, includeIds));
  }

  const linkFilter = query.moduleLinkFilter;
  if (linkFilter === "students") {
    conditions.push(existsActiveStudentLinkSql(subdomain));
  } else if (linkFilter === "faculty") {
    conditions.push(existsActiveFacultyLinkSql(subdomain));
  } else if (linkFilter === "staff") {
    conditions.push(existsActiveStaffLinkSql(subdomain));
  } else if (linkFilter === "unlinked") {
    conditions.push(sql`NOT ${existsActiveStudentLinkSql(subdomain)}`);
    conditions.push(sql`NOT ${existsActiveFacultyLinkSql(subdomain)}`);
  }

  if (query.excludeLinkedModules?.includes("students")) {
    conditions.push(sql`NOT ${existsActiveStudentLinkSql(subdomain)}`);
  }
  if (query.excludeLinkedModules?.includes("faculty")) {
    conditions.push(sql`NOT ${existsActiveFacultyLinkSql(subdomain)}`);
  }

  const search = query.search?.trim();
  if (search) {
    const searchSql = buildSearchSql(search);
    if (searchSql) conditions.push(searchSql);
  }

  return conditions;
}
