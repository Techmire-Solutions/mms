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
  contactRelationships,
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

function buildSearchSql(search: string, useJoinedContacts = false, subdomain?: string): SQL | null {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return null;
  const pattern = toSqlSearchPattern(normalized);
  const tenantMatch = subdomain ? sql`${subdomain}` : contacts.workspaceSubdomain;
  const studentTenantMatch = subdomain ? sql`${subdomain}` : students.workspaceSubdomain;

  const contactMatch = useJoinedContacts
    ? sql`(${contacts.id} IS NOT NULL AND (
        lower(COALESCE(${contacts.name}, '')) LIKE ${pattern}
        OR lower(concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})) LIKE ${pattern}
        OR COALESCE(${contacts.cnic}, '') LIKE ${pattern}
        OR EXISTS (SELECT 1 FROM ${contactPhones} cp WHERE cp.workspace_subdomain = ${tenantMatch} AND cp.contact_id = ${contacts.id} AND lower(cp.number) LIKE ${pattern})
        OR EXISTS (SELECT 1 FROM ${contactEmails} ce WHERE ce.workspace_subdomain = ${tenantMatch} AND ce.contact_id = ${contacts.id} AND lower(ce.address) LIKE ${pattern})
        OR EXISTS (SELECT 1 FROM ${contactRelationships} cr WHERE cr.workspace_subdomain = ${tenantMatch} AND cr.contact_id = ${contacts.id} AND lower(trim(COALESCE(cr.name, ''))) LIKE ${pattern})
      ))`
    : sql`EXISTS (
        SELECT 1 FROM ${contacts} c
        WHERE c.workspace_subdomain = ${studentTenantMatch}
          AND c.id = ${students.contactId}
          AND (
            lower(COALESCE(c.name, '')) LIKE ${pattern}
            OR lower(concat_ws(' ', c.first_name, c.last_name)) LIKE ${pattern}
            OR COALESCE(c.cnic, '') LIKE ${pattern}
            OR EXISTS (SELECT 1 FROM ${contactPhones} cp WHERE cp.workspace_subdomain = ${studentTenantMatch} AND cp.contact_id = c.id AND lower(cp.number) LIKE ${pattern})
            OR EXISTS (SELECT 1 FROM ${contactEmails} ce WHERE ce.workspace_subdomain = ${studentTenantMatch} AND ce.contact_id = c.id AND lower(ce.address) LIKE ${pattern})
            OR EXISTS (SELECT 1 FROM ${contactRelationships} cr WHERE cr.workspace_subdomain = ${studentTenantMatch} AND cr.contact_id = c.id AND lower(trim(COALESCE(cr.name, ''))) LIKE ${pattern})
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
      // Kept as two OR-ed comparisons instead of one COALESCE expression: the old
      // `COALESCE(registered_on::timestamptz, created_at)` could not use an index — the
      // `date -> timestamptz` cast depends on the session TimeZone, so it is not IMMUTABLE and
      // cannot even be indexed — while this form is a BitmapOr over the existing
      // `students_workspace_registered_on_idx` and `students_workspace_created_at_active_idx`.
      // Day granularity matches the filter's meaning ("registered on or after <date>").
      const since = sql`now() - (${MODULE_METRICS_DEFAULT_PERIOD_DAYS} * interval '1 day')`;
      conditions.push(sql`(
        ${students.registeredDate} >= (${since})::date
        OR (${students.registeredDate} IS NULL AND ${students.createdAt} >= ${since})
      )`);
    } else if (quickFilter === "missingGr") {
      conditions.push(sql`(${students.grNumber} is null or trim(${students.grNumber}) = '')`);
    } else {
      conditions.push(sql`${statusExpr()} = ${quickFilter}`);
    }
  }

  const search = query.search?.trim();
  if (search) {
    const searchSql = buildSearchSql(search, useJoinedContacts, subdomain);
    if (searchSql) conditions.push(searchSql);
  }

  if (query.sessionId?.trim()) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${studentEnrolledSessions} ses
      WHERE ses.workspace_subdomain = ${subdomain}
        AND ses.student_id = ${students.id}
        AND ses.session_id = ${query.sessionId.trim()}
    )`);
  }

  const className = query.className?.trim();
  if (className) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${enrollments} e
      WHERE e.workspace_subdomain = ${subdomain}
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
    // Guardian links live on the primary contact's relationship graph — the students
    // `father/mother/guardian_contact_id` columns are never written (see `normalizeStoredStudent`),
    // so matching only those columns made the Sibling section permanently empty. Keep the legacy
    // column branch for rows written before that invariant, and match the relationship graph.
    relationshipConditions.push(
      sql`${students.fatherContactId} IN (${ids})`,
      sql`${students.motherContactId} IN (${ids})`,
      sql`${students.guardianContactId} IN (${ids})`,
      sql`EXISTS (
        SELECT 1 FROM ${contactRelationships} cr
        WHERE cr.workspace_subdomain = ${subdomain}
          AND cr.contact_id = ${students.contactId}
          AND cr.related_contact_id IN (${ids})
      )`,
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
      OR EXISTS (
        SELECT 1 FROM ${contactRelationships} cr
        WHERE cr.workspace_subdomain = ${subdomain}
          AND cr.contact_id = ${students.contactId}
          AND lower(trim(COALESCE(cr.relationship, ''))) IN ('father', 'mother', 'guardian')
          AND lower(trim(COALESCE(cr.name, ''))) = ${fatherName}
      )
    )`);
  }
  if (relationshipConditions.length > 0) {
    conditions.push(sql`(${sql.join(relationshipConditions, sql` OR `)})`);
  }

  if (query.excludeId?.trim()) {
    conditions.push(ne(students.id, query.excludeId.trim()));
  }

  if (query.scopedSectionIds) {
    if (query.scopedSectionIds.length === 0) {
      // Scoped user with no section allocations has zero roster visibility
      conditions.push(sql`1 = 0`);
    } else {
      const sectionIds = sql.join(
        query.scopedSectionIds.map((id) => sql`${id}`),
        sql`, `,
      );
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${enrollments} e
        WHERE e.workspace_subdomain = ${subdomain}
          AND e.student_id = ${students.id}
          AND e.deleted_at IS NULL
          AND e.section_id IN (${sectionIds})
      )`);
    }
  }

  return conditions;
}
