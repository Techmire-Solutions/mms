import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { FacultyWidgetQuery } from "@mms/shared";
import { faculty } from "../schema.js";
import {
  joinedContactNameExpr,
  joinedPrimaryDepartmentNameExpr,
  joinedPrimaryDesignationNameExpr,
  joinedPrimaryHierarchyRankExpr,
  joinedReportsToFacultyExpr,
} from "./facultyPrimaryAppointmentSql.js";

export function activeWorkspaceWhere(subdomain: string): SQL {
  return and(eq(faculty.workspaceSubdomain, subdomain), isNull(faculty.deletedAt))!;
}

/** Field exprs assuming LATERAL primary-appointment FROM (pa_dept / pa_desig / fc). */
export function resolveFacultyFieldExpr(field: string): SQL {
  const f = field.trim();
  // Employment SSOT via fe_emp (facultyWithPrimaryAppointmentFromSql).
  if (f === "status") return sql`COALESCE(fe_emp.status, 'active')`;
  if (f === "employeeId" || f === "employee_id") return sql`COALESCE(fe_emp.employee_id, '')`;
  if (f === "specialization") return sql`COALESCE(${faculty.specialization}, '')`;
  if (f === "qualification") return sql`COALESCE(${faculty.qualification}, '')`;
  if (
    f === "joinDate" ||
    f === "join_date" ||
    f === "employmentStartDate" ||
    f === "employment_start_date"
  ) {
    return sql`COALESCE(fe_emp.employment_start_date::text, '')`;
  }
  if (f === "employmentEndDate" || f === "employment_end_date") {
    return sql`COALESCE(fe_emp.employment_end_date::text, '')`;
  }
  if (f === "performanceRating" || f === "performance_rating")
    return sql`COALESCE(${faculty.performanceRating}::text, '')`;
  if (f === "notes") return sql`COALESCE(${faculty.notes}, '')`;
  if (f === "department") return joinedPrimaryDepartmentNameExpr();
  if (f === "designation") return joinedPrimaryDesignationNameExpr();
  if (f === "hierarchyRank" || f === "hierarchy_rank")
    return sql`${joinedPrimaryHierarchyRankExpr()}::text`;
  if (f === "reportingFacultyId" || f === "reporting_faculty_id") {
    return sql`''`;
  }

  if (f === "gender") return sql`COALESCE(fc.gender, '')`;
  if (f === "dob") return sql`COALESCE(fc.dob::text, '')`;
  if (f === "city") return sql`COALESCE(fc.city, '')`;
  if (f === "name") return joinedContactNameExpr();

  return sql`''`;
}

export function singleFilterSql(
  field: string | undefined,
  operator: FacultyWidgetQuery["filterOperator"],
  value: string | undefined,
): SQL | null {
  const trimmedField = field?.trim();
  if (!trimmedField || value == null || value === "") return null;
  const op = operator ?? "equals";
  const valNormalized = value.trim().toLowerCase();

  if (
    (trimmedField === "reportingFacultyId" || trimmedField === "reporting_faculty_id") &&
    op === "equals"
  ) {
    const supervisorId = value.trim();
    if (!supervisorId) return null;
    return joinedReportsToFacultyExpr(supervisorId);
  }

  const fieldExpr = resolveFacultyFieldExpr(trimmedField);

  if (op === "equals") {
    return sql`lower(trim(${fieldExpr}::text)) = ${valNormalized}`;
  }
  if (op === "contains") {
    return sql`lower(${fieldExpr}::text) LIKE ${`%${valNormalized}%`}`;
  }
  if (op === "gt") {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return sql`NULLIF(trim(${fieldExpr}::text), '')::numeric > ${num}`;
  }
  if (op === "lt") {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return sql`NULLIF(trim(${fieldExpr}::text), '')::numeric < ${num}`;
  }
  return null;
}

export function widgetFilterSql(query: FacultyWidgetQuery): SQL | null {
  const clauses: SQL[] = [];
  const legacy = singleFilterSql(query.filterField, query.filterOperator, query.filterValue);
  if (legacy) clauses.push(legacy);
  for (const rule of query.filters ?? []) {
    const clause = singleFilterSql(rule.field, rule.operator, rule.value);
    if (clause) clauses.push(clause);
  }
  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0]!;
  return sql`(${sql.join(clauses, sql` AND `)})`;
}

export function resolveChartLimit(query: FacultyWidgetQuery): number {
  const requested = query.chartLimit ?? 8;
  return Math.min(Math.max(requested, 1), 50);
}
