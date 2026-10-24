/**
 * @file facultyPrimaryAppointmentSql.ts
 * @description Faculty Work list FROM: employment SSOT + primary employ-designation.
 */
import { sql, type SQL } from "drizzle-orm";
import { faculty } from "../schema.js";

/**
 * FROM clause: faculty + employment + LATERAL primary open employ-designation
 * + designation/department catalog + contact.
 */
export function facultyWithPrimaryAppointmentFromSql(): SQL {
  return sql`
    FROM ${faculty}
    LEFT JOIN faculty_employments fe_emp
      ON fe_emp.workspace_subdomain = ${faculty.workspaceSubdomain}
      AND fe_emp.id = ${faculty.employmentId}
      AND fe_emp.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT ed.designation_id, ed.id AS employ_designation_id,
             ed.start_date, ed.end_date, ed.status
      FROM faculty_employ_designations ed
      WHERE ed.workspace_subdomain = ${faculty.workspaceSubdomain}
        AND ed.employment_id = ${faculty.employmentId}
        AND ed.deleted_at IS NULL
        AND lower(btrim(ed.status)) = 'active'
        AND ed.end_date IS NULL
      ORDER BY ed.start_date DESC NULLS LAST, ed.updated_at DESC, ed.id DESC
      LIMIT 1
    ) fe_desig ON true
    LEFT JOIN faculty_designations pa_desig
      ON pa_desig.workspace_subdomain = ${faculty.workspaceSubdomain}
      AND pa_desig.id = fe_desig.designation_id
    LEFT JOIN faculty_departments pa_dept
      ON pa_dept.workspace_subdomain = ${faculty.workspaceSubdomain}
      AND pa_dept.id = pa_desig.department_id
    LEFT JOIN contacts fc
      ON fc.workspace_subdomain = ${faculty.workspaceSubdomain}
      AND fc.id = fe_emp.contact_id
  `;
}

/** Department name from LATERAL join aliases (requires facultyWithPrimaryAppointmentFromSql). */
export function joinedPrimaryDepartmentNameExpr(): SQL {
  return sql`COALESCE(pa_dept.name, '')`;
}

/** Designation name from LATERAL join aliases. */
export function joinedPrimaryDesignationNameExpr(): SQL {
  return sql`COALESCE(pa_desig.name, '')`;
}

/** Hierarchy rank from LATERAL join aliases. */
export function joinedPrimaryHierarchyRankExpr(): SQL {
  return sql`COALESCE(pa_desig.hierarchy_rank, 10)`;
}

/** Linked contact display name (requires facultyWithPrimaryAppointmentFromSql). */
export function joinedContactNameExpr(): SQL {
  return sql`COALESCE(
    NULLIF(trim(concat_ws(' ', fc.first_name, fc.last_name)), ''),
    NULLIF(trim(COALESCE(fc.name, '')), ''),
    ''
  )`;
}

/** Linked contact gender (requires facultyWithPrimaryAppointmentFromSql). */
export function joinedContactGenderExpr(): SQL {
  return sql`lower(trim(COALESCE(fc.gender, '')))`;
}

/** Reports-to filter matching faculty reporting to supervisor's primary designation. */
export function joinedReportsToFacultyExpr(supervisorFacultyId: string): SQL {
  return sql`pa_desig.parent_designation_id IN (
    SELECT sup_fa.designation_id
    FROM faculty_assignments sup_fa
    WHERE sup_fa.workspace_subdomain = ${faculty.workspaceSubdomain}
      AND sup_fa.faculty_id = ${supervisorFacultyId}
      AND sup_fa.is_primary = true
      AND sup_fa.status = 'active'
      AND sup_fa.deleted_at IS NULL
  )`;
}
