import { eq, sql } from 'drizzle-orm';
import { type Student } from '@mms/shared';
import { students, studentEnrolledSessions } from '../schema.js';
import { withTenant, type AppDb } from '../tenant-context.js';
import { mapAuditToInsert } from './repositoryMappers.js';
import { invalidateMultiTierCache } from '../../lib/cache/index.js';

export type StudentInsert = typeof students.$inferInsert;

const KNOWN_STUDENT_KEYS = new Set([
  'id', 'workspaceSubdomain', 'contactId', 'fatherContactId', 'motherContactId', 'guardianContactId',
  'fatherName', 'motherName', 'guardianName', 'grNumber', 'studentId', 'status', 'registeredDate',
  'enrollmentDate', 'discountType', 'discountPct', 'registrationType', 'notes', 'enrolledSessions',
  'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'deletionReason', 'restoredAt', 'restoredBy',
  'deletedWithCascade', 'createdBy', 'updatedBy', 'customFields',
  'name', 'gender', 'dob', 'phone', 'email', 'city', 'cnic', 'isSyed', 'avatar',
]);

function extractStudentCustomFields(student: Student): Record<string, unknown> {
  const custom: Record<string, unknown> = {
    ...(typeof student.customFields === 'object' && student.customFields !== null ? student.customFields : {}),
  };
  for (const [key, val] of Object.entries(student)) {
    if (!KNOWN_STUDENT_KEYS.has(key) && val !== undefined) {
      custom[key] = val;
    }
  }
  return custom;
}

export function studentWriteValues(subdomain: string, student: Student): StudentInsert {
  const fatherContactId = student.fatherContactId ? String(student.fatherContactId) : null;
  const motherContactId = student.motherContactId ? String(student.motherContactId) : null;
  const guardianContactId = student.guardianContactId ? String(student.guardianContactId) : null;
  const grNumber = student.grNumber?.trim() ? student.grNumber.trim().toLowerCase() : null;
  const studentId = student.studentId?.trim() ? student.studentId.trim().toLowerCase() : null;
  return {
    id: String(student.id),
    workspaceSubdomain: subdomain,
    contactId: student.contactId ? String(student.contactId) : null,
    fatherContactId,
    motherContactId,
    guardianContactId,
    // Person Modules: identity names live on linked contacts when FKs are set.
    fatherName: fatherContactId ? null : (student.fatherName ?? null),
    motherName: motherContactId ? null : (student.motherName ?? null),
    guardianName: guardianContactId ? null : (student.guardianName ?? null),
    grNumber,
    studentId,
    status: student.status ?? 'active',
    registeredDate: student.registeredDate ?? null,
    enrollmentDate: student.enrollmentDate ?? null,
    discountType: student.discountType ?? null,
    discountPct: student.discountPct != null ? String(student.discountPct) : null,
    registrationType: student.registrationType ?? null,
    notes: student.notes ?? null,
    customFields: extractStudentCustomFields(student),
    ...mapAuditToInsert(student),
  } satisfies StudentInsert;
}

export function studentUpdateSetValues(subdomain: string, student: Student) {
  const { id: _id, workspaceSubdomain: _subdomain, createdAt: _createdAt, createdBy: _createdBy, ...setFields } = studentWriteValues(subdomain, student);
  return setFields;
}

export async function persistStudentTx(
  tx: AppDb,
  subdomain: string,
  student: Student,
): Promise<void> {
  await tx
    .insert(students)
    .values(studentWriteValues(subdomain, student))
    .onConflictDoUpdate({
      target: [students.workspaceSubdomain, students.id],
      set: studentUpdateSetValues(subdomain, student),
    });

  // `enrolledSessions` is derived from enrollments (enrollmentSessionSync) — never written from a student save.
}

export async function saveStudent(tenant: string, student: Student): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await persistStudentTx(tx, subdomain, student);
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: 'students', key: String(student.id) });
}

export async function bulkSaveStudents(tenant: string, items: Student[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  if (items.length === 0) return;
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(students)
      .values(items.map((student) => studentWriteValues(subdomain, student)))
      .onConflictDoUpdate({
        target: [students.workspaceSubdomain, students.id],
        set: {
          contactId: sql`excluded.contact_id`,
          fatherContactId: sql`excluded.father_contact_id`,
          motherContactId: sql`excluded.mother_contact_id`,
          guardianContactId: sql`excluded.guardian_contact_id`,
          fatherName: sql`excluded.father_name`,
          motherName: sql`excluded.mother_name`,
          guardianName: sql`excluded.guardian_name`,
          grNumber: sql`excluded.gr_number`,
          studentId: sql`excluded.student_id`,
          status: sql`excluded.status`,
          registeredDate: sql`excluded.registered_date`,
          enrollmentDate: sql`excluded.enrollment_date`,
          discountType: sql`excluded.discount_type`,
          discountPct: sql`excluded.discount_pct`,
          registrationType: sql`excluded.registration_type`,
          notes: sql`excluded.notes`,
          customFields: sql`excluded.custom_fields`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          restoredAt: sql`excluded.restored_at`,
          restoredBy: sql`excluded.restored_by`,
          updatedAt: new Date(),
          updatedBy: sql`excluded.updated_by`,
        },
      });
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: 'students' });
}

export async function replaceStudentsForWorkspace(tenant: string, items: Student[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(studentEnrolledSessions).where(eq(studentEnrolledSessions.workspaceSubdomain, subdomain));
    await tx.delete(students).where(eq(students.workspaceSubdomain, subdomain));
    if (items.length === 0) return;

    await tx.insert(students).values(
      items.map((student) => studentWriteValues(subdomain, student)),
    );

    const allSessions = items.flatMap((student) => {
      const sessions = Array.isArray(student.enrolledSessions) ? student.enrolledSessions : [];
      return sessions.map((sessionId, idx) => ({
        id: `${student.id}_sess_${idx}_${String(sessionId).slice(0, 30)}`,
        workspaceSubdomain: subdomain,
        studentId: student.id,
        sessionId: String(sessionId),
        sortOrder: idx,
      }));
    });

    if (allSessions.length > 0) {
      await tx.insert(studentEnrolledSessions).values(allSessions);
    }
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: 'students' });
}

