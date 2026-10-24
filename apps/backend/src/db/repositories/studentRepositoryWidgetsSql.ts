import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { StudentsWidgetQuery } from "@mms/shared";
import { students, contacts, contactAddresses } from "../schema.js";

export function activeWorkspaceWhere(subdomain: string): SQL {
  return and(eq(students.workspaceSubdomain, subdomain), isNull(students.deletedAt))!;
}

export const STUDENT_CONTACT_WIDGET_FIELDS = new Set(["gender", "dob", "name", "city"]);

export function widgetNeedsContactsJoin(query: StudentsWidgetQuery): boolean {
  if (query.targetField && STUDENT_CONTACT_WIDGET_FIELDS.has(query.targetField.trim())) return true;
  if (query.xAxisField && STUDENT_CONTACT_WIDGET_FIELDS.has(query.xAxisField.trim())) return true;
  if (query.filterField && STUDENT_CONTACT_WIDGET_FIELDS.has(query.filterField.trim())) return true;
  for (const rule of query.filters ?? []) {
    if (rule.field && STUDENT_CONTACT_WIDGET_FIELDS.has(rule.field.trim())) return true;
  }
  return false;
}

export function resolveStudentFieldExpr(field: string, useJoinedContacts = false): SQL {
  const f = field.trim();
  if (f === "status") return sql`COALESCE(${students.status}, 'active')`;
  if (f === "grNumber" || f === "gr_number") return sql`COALESCE(${students.grNumber}, '')`;
  if (f === "studentId" || f === "student_id") return sql`COALESCE(${students.studentId}, '')`;
  if (f === "registeredDate" || f === "registered_date")
    return sql`COALESCE(${students.registeredDate}::text, '')`;
  if (f === "enrollmentDate" || f === "enrollment_date")
    return sql`COALESCE(${students.enrollmentDate}::text, '')`;
  if (f === "discountType" || f === "discount_type")
    return sql`COALESCE(${students.discountType}, '')`;
  if (f === "discountPct" || f === "discount_pct") return sql`COALESCE(${students.discountPct}, 0)`;
  if (f === "registrationType" || f === "registration_type")
    return sql`COALESCE(${students.registrationType}, '')`;
  if (f === "notes") return sql`COALESCE(${students.notes}, '')`;
  if (f === "fatherName" || f === "father_name") {
    return sql`COALESCE(
      ${students.fatherName},
      (SELECT COALESCE(NULLIF(trim(concat_ws(' ', fc.first_name, fc.last_name)), ''), fc.name) FROM ${contacts} fc WHERE fc.workspace_subdomain = ${students.workspaceSubdomain} AND fc.id = ${students.fatherContactId} LIMIT 1),
      ''
    )`;
  }
  if (f === "motherName" || f === "mother_name") {
    return sql`COALESCE(
      ${students.motherName},
      (SELECT COALESCE(NULLIF(trim(concat_ws(' ', mc.first_name, mc.last_name)), ''), mc.name) FROM ${contacts} mc WHERE mc.workspace_subdomain = ${students.workspaceSubdomain} AND mc.id = ${students.motherContactId} LIMIT 1),
      ''
    )`;
  }
  if (f === "guardianName" || f === "guardian_name") {
    return sql`COALESCE(
      ${students.guardianName},
      (SELECT COALESCE(NULLIF(trim(concat_ws(' ', gc.first_name, gc.last_name)), ''), gc.name) FROM ${contacts} gc WHERE gc.workspace_subdomain = ${students.workspaceSubdomain} AND gc.id = ${students.guardianContactId} LIMIT 1),
      ''
    )`;
  }

  if (f === "gender") {
    return useJoinedContacts
      ? sql`COALESCE(${contacts.gender}, '')`
      : sql`COALESCE((SELECT c.gender FROM ${contacts} c WHERE c.workspace_subdomain = ${students.workspaceSubdomain} AND c.id = ${students.contactId} LIMIT 1), '')`;
  }
  if (f === "dob") {
    return useJoinedContacts
      ? sql`COALESCE(${contacts.dob}::text, '')`
      : sql`COALESCE((SELECT c.dob::text FROM ${contacts} c WHERE c.workspace_subdomain = ${students.workspaceSubdomain} AND c.id = ${students.contactId} LIMIT 1), '')`;
  }
  if (f === "city") {
    return sql`COALESCE((SELECT ca.city FROM ${contactAddresses} ca WHERE ca.workspace_subdomain = ${students.workspaceSubdomain} AND ca.contact_id = ${students.contactId} ORDER BY ca.is_primary DESC, ca.sort_order ASC LIMIT 1), '')`;
  }
  if (f === "name") {
    return useJoinedContacts
      ? sql`COALESCE(NULLIF(trim(concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})), ''), ${contacts.name}, '')`
      : sql`COALESCE((SELECT COALESCE(NULLIF(trim(concat_ws(' ', c.first_name, c.last_name)), ''), c.name) FROM ${contacts} c WHERE c.workspace_subdomain = ${students.workspaceSubdomain} AND c.id = ${students.contactId} LIMIT 1), '')`;
  }

  return sql`''`;
}

function singleFilterSql(
  field: string | undefined,
  operator: StudentsWidgetQuery["filterOperator"],
  value: string | undefined,
  useJoinedContacts = false,
): SQL | null {
  const trimmedField = field?.trim();
  if (!trimmedField || value == null || value === "") return null;
  const fieldExpr = resolveStudentFieldExpr(trimmedField, useJoinedContacts);
  const op = operator ?? "equals";
  const valNormalized = value.trim().toLowerCase();

  if (op === "equals") {
    return sql`lower(trim(${fieldExpr}::text)) = ${valNormalized}`;
  }
  if (op === "contains") {
    return sql`lower(${fieldExpr}::text) LIKE ${`%${valNormalized}%`}`;
  }
  if (op === "gt") {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return sql`CASE WHEN ${fieldExpr}::text ~ '^-?[0-9]+(\.[0-9]+)?$' THEN ${fieldExpr}::text::numeric ELSE NULL END > ${num}`;
  }
  if (op === "lt") {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return sql`CASE WHEN ${fieldExpr}::text ~ '^-?[0-9]+(\.[0-9]+)?$' THEN ${fieldExpr}::text::numeric ELSE NULL END < ${num}`;
  }
  return null;
}

export function widgetFilterSql(query: StudentsWidgetQuery, useJoinedContacts = false): SQL | null {
  const clauses: SQL[] = [];
  const legacy = singleFilterSql(
    query.filterField,
    query.filterOperator,
    query.filterValue,
    useJoinedContacts,
  );
  if (legacy) clauses.push(legacy);
  for (const rule of query.filters ?? []) {
    const clause = singleFilterSql(rule.field, rule.operator, rule.value, useJoinedContacts);
    if (clause) clauses.push(clause);
  }
  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0]!;
  return sql`(${sql.join(clauses, sql` AND `)})`;
}

export function resolveChartLimit(query: StudentsWidgetQuery): number {
  const requested = query.chartLimit ?? 8;
  return Math.min(Math.max(requested, 1), 50);
}
