import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  dayBeforeIsoDate,
  SINGLE_HOLDER_SECTION_ROLES,
  type SectionAssignmentEndBody,
  type SectionStaffAssignBody,
  type SectionStaffAssignment,
} from "@mms/shared";
import { faculty, sectionStaffAssignments, sessionClassSections } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

const TABLE = "section_staff_assignments";

type AssignmentRow = Omit<SectionStaffAssignment, "createdAt"> & { createdAt: Date };

async function selectAssignmentsTx(
  tx: TenantTransaction,
  subdomain: string,
  sectionId: string,
  id?: string,
): Promise<SectionStaffAssignment[]> {
  const result = await tx.execute<AssignmentRow>(sql`
    SELECT a.id, a.section_id AS "sectionId", a.faculty_id AS "facultyId",
           COALESCE(NULLIF(concat_ws(' ', c.first_name, c.last_name), ''), a.faculty_id) AS "facultyName",
           a.role, a.subject_id AS "subjectId", sub.name AS "subjectName",
           to_char(a.start_on, 'YYYY-MM-DD') AS "startOn", to_char(a.end_on, 'YYYY-MM-DD') AS "endOn",
           a.change_reason AS "changeReason", a.created_at AS "createdAt"
      FROM section_staff_assignments a
      LEFT JOIN faculty f ON f.workspace_subdomain = a.workspace_subdomain AND f.id = a.faculty_id
      LEFT JOIN faculty_employments fe ON fe.workspace_subdomain = f.workspace_subdomain AND fe.id = f.employment_id
      LEFT JOIN contacts c ON c.workspace_subdomain = fe.workspace_subdomain AND c.id = fe.contact_id
      LEFT JOIN subjects sub ON sub.workspace_subdomain = a.workspace_subdomain AND sub.id = a.subject_id
     WHERE a.workspace_subdomain = ${subdomain} AND a.section_id = ${sectionId} AND a.deleted_at IS NULL
       ${id ? sql`AND a.id = ${id}` : sql``}
     ORDER BY (a.end_on IS NULL) DESC, a.start_on DESC, a.role
  `);
  return result.rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }));
}

export function listSectionStaff(
  tenant: string,
  sectionId: string,
): Promise<SectionStaffAssignment[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, (tx) => selectAssignmentsTx(tx, subdomain, sectionId));
}

async function lockSectionTx(
  tx: TenantTransaction,
  subdomain: string,
  sectionId: string,
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`${subdomain}:section-staff:${sectionId}`}))`,
  );
  const [section] = await tx
    .select({ status: sessionClassSections.status })
    .from(sessionClassSections)
    .where(
      and(
        eq(sessionClassSections.workspaceSubdomain, subdomain),
        eq(sessionClassSections.id, sectionId),
      ),
    )
    .limit(1);
  if (!section) throw new NotFoundError("Section not found");
}

/**
 * Assigns staff from `startOn`. For single-holder roles (class teacher; subject teacher per subject)
 * the current holder is closed the day before — history is never overwritten.
 */
export async function assignSectionStaff(
  tenant: string,
  sectionId: string,
  body: SectionStaffAssignBody,
  actorUserId: string,
): Promise<SectionStaffAssignment> {
  const subdomain = tenant.trim().toLowerCase();
  const subjectId = body.role === "class_teacher" ? null : (body.subjectId ?? null);
  if (body.role === "subject_teacher" && !subjectId)
    throw new ValidationError("A subject teacher needs a subject");
  return withTenant(subdomain, async (tx) => {
    await lockSectionTx(tx, subdomain, sectionId);
    const [member] = await tx
      .select({ id: faculty.id })
      .from(faculty)
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          eq(faculty.id, body.facultyId),
          isNull(faculty.deletedAt),
        ),
      )
      .limit(1);
    if (!member) throw new ValidationError("Faculty member not found");

    const sameSlot = and(
      eq(sectionStaffAssignments.workspaceSubdomain, subdomain),
      eq(sectionStaffAssignments.sectionId, sectionId),
      eq(sectionStaffAssignments.role, body.role),
      isNull(sectionStaffAssignments.deletedAt),
      SINGLE_HOLDER_SECTION_ROLES.includes(body.role)
        ? sql`${sectionStaffAssignments.subjectId} IS NOT DISTINCT FROM ${subjectId}`
        : eq(sectionStaffAssignments.facultyId, body.facultyId),
      sql`(${sectionStaffAssignments.endOn} IS NULL OR ${sectionStaffAssignments.endOn} >= ${body.startOn}::date)`,
    );
    const open = await tx
      .select({
        id: sectionStaffAssignments.id,
        startOn: sectionStaffAssignments.startOn,
        facultyId: sectionStaffAssignments.facultyId,
      })
      .from(sectionStaffAssignments)
      .where(sameSlot);
    if (open.some((row) => row.startOn >= body.startOn)) {
      throw new ConflictError("An assignment for this role already starts on or after this date");
    }
    if (!SINGLE_HOLDER_SECTION_ROLES.includes(body.role) && open.length > 0) {
      throw new ConflictError("This assistant is already assigned to the section");
    }
    const closeOn = dayBeforeIsoDate(body.startOn);
    for (const row of open) {
      await tx
        .update(sectionStaffAssignments)
        .set({ endOn: closeOn, changeReason: body.reason ?? "Replaced", updatedAt: new Date() })
        .where(
          and(
            eq(sectionStaffAssignments.workspaceSubdomain, subdomain),
            eq(sectionStaffAssignments.id, row.id),
          ),
        );
    }

    const id = randomUUID();
    await tx.insert(sectionStaffAssignments).values({
      id,
      workspaceSubdomain: subdomain,
      sectionId,
      facultyId: body.facultyId,
      role: body.role,
      subjectId,
      startOn: body.startOn,
      changeReason: body.reason ?? null,
      createdBy: actorUserId,
    });
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: TABLE,
      recordId: id,
      actionType: "CREATE",
      realUserId: actorUserId,
      newState: { sectionId, ...body, closed: open.map((row) => row.id) },
    });
    const [created] = await selectAssignmentsTx(tx, subdomain, sectionId, id);
    return created;
  });
}

/** Ends an assignment on `endOn` (inclusive). */
export async function endSectionStaff(
  tenant: string,
  sectionId: string,
  assignmentId: string,
  body: SectionAssignmentEndBody,
  actorUserId: string,
): Promise<SectionStaffAssignment> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await lockSectionTx(tx, subdomain, sectionId);
    const scope = and(
      eq(sectionStaffAssignments.workspaceSubdomain, subdomain),
      eq(sectionStaffAssignments.sectionId, sectionId),
      eq(sectionStaffAssignments.id, assignmentId),
      isNull(sectionStaffAssignments.deletedAt),
    );
    const [row] = await tx
      .select({ startOn: sectionStaffAssignments.startOn })
      .from(sectionStaffAssignments)
      .where(scope)
      .limit(1);
    if (!row) throw new NotFoundError("Assignment not found");
    if (body.endOn < row.startOn)
      throw new ValidationError("End date cannot be before the start date");
    await tx
      .update(sectionStaffAssignments)
      .set({ endOn: body.endOn, changeReason: body.reason ?? null, updatedAt: new Date() })
      .where(scope);
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: TABLE,
      recordId: assignmentId,
      actionType: "UPDATE",
      realUserId: actorUserId,
      newState: { endOn: body.endOn, reason: body.reason ?? null },
    });
    const [updated] = await selectAssignmentsTx(tx, subdomain, sectionId, assignmentId);
    return updated;
  });
}
