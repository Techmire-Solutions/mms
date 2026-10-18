import { and, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { SectionAssignmentEndBody, SectionStudentRole, SectionStudentRoleBody } from '@mms/shared';
import { enrollments, sectionStudentRoles } from '../schema.js';
import { withTenant, withTenantRead, type TenantTransaction } from '../tenant-context.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/httpErrors.js';
import { recordModernAuditEvent } from '../../services/auditTrailService.js';

const TABLE = 'section_student_roles';

async function selectRolesTx(tx: TenantTransaction, subdomain: string, sectionId: string, id?: string): Promise<SectionStudentRole[]> {
  const result = await tx.execute<SectionStudentRole>(sql`
    SELECT r.id, r.section_id AS "sectionId", r.enrollment_id AS "enrollmentId", COALESCE(e.student_name, '') AS "studentName",
           r.role, to_char(r.start_on, 'YYYY-MM-DD') AS "startOn", to_char(r.end_on, 'YYYY-MM-DD') AS "endOn"
      FROM section_student_roles r
      LEFT JOIN enrollments e ON e.workspace_subdomain = r.workspace_subdomain AND e.id = r.enrollment_id
     WHERE r.workspace_subdomain = ${subdomain} AND r.section_id = ${sectionId} AND r.deleted_at IS NULL
       ${id ? sql`AND r.id = ${id}` : sql``}
     ORDER BY (r.end_on IS NULL) DESC, r.start_on DESC
  `);
  return result.rows;
}

export function listSectionStudentRoles(tenant: string, sectionId: string): Promise<SectionStudentRole[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, (tx) => selectRolesTx(tx, subdomain, sectionId));
}

/** Gives an enrolled student of this section a monitor/assistant role from `startOn`. */
export async function addSectionStudentRole(tenant: string, sectionId: string, body: SectionStudentRoleBody, actorUserId: string): Promise<SectionStudentRole> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [enrollment] = await tx.select({ id: enrollments.id }).from(enrollments).where(and(
      eq(enrollments.workspaceSubdomain, subdomain), eq(enrollments.id, body.enrollmentId), eq(enrollments.sectionId, sectionId),
      isNull(enrollments.deletedAt), sql`${enrollments.status} <> 'cancelled'`)).limit(1);
    if (!enrollment) throw new ValidationError('The student is not enrolled in this section');
    const [duplicate] = await tx.select({ id: sectionStudentRoles.id }).from(sectionStudentRoles).where(and(
      eq(sectionStudentRoles.workspaceSubdomain, subdomain), eq(sectionStudentRoles.sectionId, sectionId),
      eq(sectionStudentRoles.enrollmentId, body.enrollmentId), eq(sectionStudentRoles.role, body.role),
      isNull(sectionStudentRoles.deletedAt), sql`(${sectionStudentRoles.endOn} IS NULL OR ${sectionStudentRoles.endOn} >= ${body.startOn}::date)`)).limit(1);
    if (duplicate) throw new ConflictError('The student already holds this role');
    const id = randomUUID();
    await tx.insert(sectionStudentRoles).values({ id, workspaceSubdomain: subdomain, sectionId, ...body, createdBy: actorUserId });
    await recordModernAuditEvent(tx, { workspaceSubdomain: subdomain, tableName: TABLE, recordId: id, actionType: 'CREATE', realUserId: actorUserId, newState: { sectionId, ...body } });
    const [created] = await selectRolesTx(tx, subdomain, sectionId, id);
    return created;
  });
}

export async function endSectionStudentRole(tenant: string, sectionId: string, roleId: string, body: SectionAssignmentEndBody, actorUserId: string): Promise<SectionStudentRole> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const scope = and(eq(sectionStudentRoles.workspaceSubdomain, subdomain), eq(sectionStudentRoles.sectionId, sectionId),
      eq(sectionStudentRoles.id, roleId), isNull(sectionStudentRoles.deletedAt));
    const [row] = await tx.select({ startOn: sectionStudentRoles.startOn }).from(sectionStudentRoles).where(scope).limit(1);
    if (!row) throw new NotFoundError('Role not found');
    if (body.endOn < row.startOn) throw new ValidationError('End date cannot be before the start date');
    await tx.update(sectionStudentRoles).set({ endOn: body.endOn, updatedAt: new Date() }).where(scope);
    await recordModernAuditEvent(tx, { workspaceSubdomain: subdomain, tableName: TABLE, recordId: roleId, actionType: 'UPDATE', realUserId: actorUserId, newState: { endOn: body.endOn } });
    const [updated] = await selectRolesTx(tx, subdomain, sectionId, roleId);
    return updated;
  });
}
