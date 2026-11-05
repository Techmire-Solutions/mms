import { sql, type SQL } from "drizzle-orm";
import { contacts, students, faculty, facultyEmployments, tenantUsers } from "../schema.js";

/**
 * SQL predicates linking a contact to another module's record.
 *
 * Single owner: the Work-list link filters (`students|faculty|staff|unlinked`) and
 * the messaging recipient `moduleLinkFilter` both build on these, so the typed
 * column references cannot drift between copies.
 */
export const FACULTY_USER_ROLES_SQL = sql`('faculty', 'teacher', 'assistant_teacher')`;

/** True when the contact is the primary guardian/student contact of an active student. */
export function existsActiveStudentLinkSql(subdomain: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${students}
    WHERE ${students.workspaceSubdomain} = ${subdomain}
      AND ${students.deletedAt} IS NULL
      AND NULLIF(trim(${students.contactId}), '') = ${contacts.id}
  )`;
}

/** True when the contact owns an active faculty employment. */
export function existsActiveFacultyLinkSql(subdomain: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${faculty}
    INNER JOIN ${facultyEmployments}
      ON ${facultyEmployments.workspaceSubdomain} = ${faculty.workspaceSubdomain}
      AND ${facultyEmployments.id} = ${faculty.employmentId}
      AND ${facultyEmployments.deletedAt} IS NULL
    WHERE ${faculty.workspaceSubdomain} = ${subdomain}
      AND ${faculty.deletedAt} IS NULL
      AND NULLIF(trim(${facultyEmployments.contactId}), '') = ${contacts.id}
  )`;
}

/** True when an active non-faculty staff user links to the contact. */
export function existsActiveStaffLinkSql(subdomain: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${tenantUsers}
    WHERE ${tenantUsers.workspaceSubdomain} = ${subdomain}
      AND ${tenantUsers.deletedAt} IS NULL
      AND NULLIF(trim(${tenantUsers.contactId}), '') = ${contacts.id}
      AND lower(${tenantUsers.role}) NOT IN ${FACULTY_USER_ROLES_SQL}
  )`;
}
