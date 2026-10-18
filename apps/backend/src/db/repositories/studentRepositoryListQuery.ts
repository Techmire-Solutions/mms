import { eq, isNotNull, isNull, ne, sql, type SQL } from "drizzle-orm";
import {
  dedupeTrimmedIds,
  isQueryFlagTrue,
  MODULE_METRICS_DEFAULT_PERIOD_DAYS,
  toSqlSearchPattern,
  type StudentsListQuery,
} from "@mms/shared";
import {
  students,
  studentEnrolledSessions,
  enrollments,
  contacts,
  contactPhones,
  contactEmails,
} from "../schema.js";

export { buildOrderBy } from "./studentRepositoryListSort.js";
export const STUDENT_SORT_FIELDS = new Set([
  "name",
  "grNumber",
  "status",
  "gender",
  "registeredDate",
  "dob",
  "studentId",
  "updatedAt",
]);

export function statusExpr(): SQL {
  return sql`COALESCE(${students.status}, 'active')`;
}

/** Gender from linked contact (Contacts SSOT). */
export function linkedContactGenderExpr(): SQL {
  return sql`lower(trim(COALESCE((SELECT c.gender FROM ${contacts} c WHERE c.workspace_subdomain = ${students.workspaceSubdomain} AND c.id = ${students.contactId} LIMIT 1), '')))`;
}

/** DOB from linked contact (Contacts SSOT). */
export function linkedContactDobExpr(): SQL {
  return sql`NULLIF(trim(COALESCE((SELECT c.dob::text FROM ${contacts} c WHERE c.workspace_subdomain = ${students.workspaceSubdomain} AND c.id = ${students.contactId} LIMIT 1), '')), '')`;
}

/** Display name from linked contact for Work sort (Contacts SSOT). */
export function linkedContactNameSortExpr(): SQL {
  return sql`lower(trim(COALESCE((SELECT COALESCE(NULLIF(trim(concat_ws(' ', c.first_name, c.last_name)), ''), NULLIF(trim(COALESCE(c.name, '')), ''), '') FROM ${contacts} c WHERE c.workspace_subdomain = ${students.workspaceSubdomain} AND c.id = ${students.contactId} LIMIT 1), '')))`;
}

export function grNumberExpr(): SQL {
  return sql`lower(trim(COALESCE(${students.grNumber}, '')))`;
}

function buildSearchSql(search: string, useJoinedContacts = false): SQL | null {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return null;
  const pattern = toSqlSearchPattern(normalized);
  const contactMatch = useJoinedContacts
    ? sql`(${contacts.id} IS NOT NULL AND (
        lower(COALESCE(${contacts.name}, '')) LIKE ${pattern}
        OR lower(concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})) LIKE ${pattern}
        OR COALESCE(${contacts.cnic}, '') LIKE ${pattern}
        OR EXISTS (SELECT 1 FROM ${contactPhones} cp WHERE cp.workspace_subdomain = ${contacts.workspaceSubdomain} AND cp.contact_id = ${contacts.id} AND lower(cp.number) LIKE ${pattern})
        OR EXISTS (SELECT 1 FROM ${contactEmails} ce WHERE ce.workspace_subdomain = ${contacts.workspaceSubdomain} AND ce.contact_id = ${contacts.id} AND lower(ce.address) LIKE ${pattern})
      ))`
    : sql`EXISTS (
        SELECT 1 FROM ${contacts} c
        WHERE c.workspace_subdomain = ${students.workspaceSubdomain}
          AND c.id = ${students.contactId}
          AND (
            lower(COALESCE(c.name, '')) LIKE ${pattern}
            OR lower(concat_ws(' ', c.first_name, c.last_name)) LIKE ${pattern}
            OR COALESCE(c.cnic, '') LIKE ${pattern}
            OR EXISTS (SELECT 1 FROM ${contactPhones} cp WHERE cp.workspace_subdomain = c.workspace_subdomain AND cp.contact_id = c.id AND lower(cp.number) LIKE ${pattern})
            OR EXISTS (SELECT 1 FROM ${contactEmails} ce WHERE ce.workspace_subdomain = c.workspace_subdomain AND ce.contact_id = c.id AND lower(ce.address) LIKE ${pattern})
          )
      )`;
  return sql`(
    lower(COALESCE(${students.grNumber}, '')) LIKE ${pattern}
    OR lower(COALESCE(${students.studentId}, '')) LIKE ${pattern}
    OR ${contactMatch}
  )`;
}

export function buildListConditions(
  subdomain: string,
  query: StudentsListQuery,
  useJoinedContacts = false,
): SQL[] {
  const conditions: SQL[] = [eq(students.workspaceSubdomain, subdomain)];

  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(students.deletedAt));
  } else {
    conditions.push(isNull(students.deletedAt));
  }

  const rawStatuses = dedupeTrimmedIds(query.status);
  if (rawStatuses.length > 0) {
    const statuses = rawStatuses.map((status) => status.toLowerCase());
    conditions.push(
      sql`${statusExpr()} IN (${sql.join(
        statuses.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  }

  if (query.gender?.trim()) {
    const genderFilter = query.gender.trim().toLowerCase();
    conditions.push(
      useJoinedContacts
        ? sql`lower(trim(COALESCE(${contacts.gender}, ''))) = ${genderFilter}`
        : sql`${linkedContactGenderExpr()} = ${genderFilter}`,
    );
  }

  const quickFilter = query.quickFilter;
  if (quickFilter && quickFilter !== "all") {
    if (quickFilter === "new") {
      const since = sql`now() - (${MODULE_METRICS_DEFAULT_PERIOD_DAYS} * interval '1 day')`;
      conditions.push(sql`COALESCE(
        CASE WHEN ${students.registeredDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN ${students.registeredDate}::timestamptz ELSE NULL END,
        ${students.createdAt}
      ) >= ${since}`);
    } else if (quickFilter === "missingGr") {
      conditions.push(sql`(${students.grNumber} is null or trim(${students.grNumber}) = '')`);
    } else {
      conditions.push(sql`${statusExpr()} = ${quickFilter}`);
    }
  }

  const search = query.search?.trim();
  if (search) {
    const searchSql = buildSearchSql(search, useJoinedContacts);
    if (searchSql) conditions.push(searchSql);
  }

  if (query.sessionId?.trim()) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${studentEnrolledSessions} ses
      WHERE ses.workspace_subdomain = ${students.workspaceSubdomain}
        AND ses.student_id = ${students.id}
        AND ses.session_id = ${query.sessionId.trim()}
    )`);
  }

  const className = query.className?.trim();
  if (className) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${enrollments} e
      WHERE e.workspace_subdomain = ${students.workspaceSubdomain}
        AND e.student_id = ${students.id}
        AND e.deleted_at IS NULL
        AND (
          lower(trim(e.class_name)) = lower(trim(${className}))
          OR e.class_id = ${className}
        )
    )`);
  }

  const relatedContactIds = dedupeTrimmedIds(query.relatedContactIds);
  const fatherName = query.fatherName?.trim().toLowerCase();
  const relationshipConditions: SQL[] = [];
  if (relatedContactIds.length > 0) {
    const ids = sql.join(
      relatedContactIds.map((id) => sql`${id}`),
      sql`, `,
    );
    relationshipConditions.push(
      sql`${students.fatherContactId} IN (${ids})`,
      sql`${students.motherContactId} IN (${ids})`,
      sql`${students.guardianContactId} IN (${ids})`,
    );
  }
  if (fatherName) {
    relationshipConditions.push(sql`(
      lower(trim(COALESCE(${students.fatherName}, ''))) = ${fatherName}
      OR EXISTS (
        SELECT 1 FROM ${contacts} fc
        WHERE fc.workspace_subdomain = ${students.workspaceSubdomain}
          AND fc.id = ${students.fatherContactId}
          AND (
            lower(trim(COALESCE(fc.name, ''))) = ${fatherName}
            OR lower(trim(concat_ws(' ', fc.first_name, fc.last_name))) = ${fatherName}
          )
      )
    )`);
  }
  if (relationshipConditions.length > 0) {
    conditions.push(sql`(${sql.join(relationshipConditions, sql` OR `)})`);
  }

  if (query.excludeId?.trim()) {
    conditions.push(ne(students.id, query.excludeId.trim()));
  }

  return conditions;
}
