import { desc, asc, eq, inArray, isNotNull, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import { isQueryFlagTrue, type ContactsListQuery } from "@mms/shared";
import { contacts, contactAddresses } from "../schema.js";
import { hasEmailSql, hasPhoneSql, hasWhatsAppSql } from "./contactRepositorySql.js";
import {
  existsActiveStudentLinkSql,
  existsActiveFacultyLinkSql,
  existsActiveStaffLinkSql,
} from "./contactRepositoryList.js";
import { isSyedSql, buildSearchSql } from "./contactRepositoryListSql.js";

export const CONTACT_SORT_FIELDS = new Set([
  "name",
  "firstName",
  "lastName",
  "city",
  "gender",
  "createdAt",
  "updatedAt",
]);

export function buildOrderBy(
  sortField: string | undefined,
  sortDir: "asc" | "desc" | "" | undefined,
): SQL {
  const dir = sortDir === "desc" ? "desc" : "asc";
  const field = sortField?.trim();
  if (!field || !CONTACT_SORT_FIELDS.has(field)) {
    return sql`${contacts.id} asc`;
  }
  if (field === "updatedAt") {
    return dir === "desc" ? desc(contacts.updatedAt) : asc(contacts.updatedAt);
  }
  if (field === "createdAt") {
    return dir === "desc" ? desc(contacts.createdAt) : asc(contacts.createdAt);
  }
  if (field === "name") {
    return dir === "desc" ? desc(contacts.name) : asc(contacts.name);
  }
  if (field === "firstName") {
    return dir === "desc" ? desc(contacts.firstName) : asc(contacts.firstName);
  }
  if (field === "lastName") {
    return dir === "desc" ? desc(contacts.lastName) : asc(contacts.lastName);
  }
  if (field === "gender") {
    return dir === "desc" ? desc(contacts.gender) : asc(contacts.gender);
  }
  if (field === "city") {
    const cityExpr = sql`(
      SELECT a.city FROM ${contactAddresses} a
      WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain}
        AND a.contact_id = ${contacts.id}
      ORDER BY CASE WHEN a.is_primary THEN 0 ELSE 1 END, a.sort_order ASC
      LIMIT 1
    )`;
    return dir === "desc" ? desc(cityExpr) : asc(cityExpr);
  }
  return sql`${contacts.id} asc`;
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
