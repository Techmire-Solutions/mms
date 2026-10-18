import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { toSqlSearchPattern, type AdmissionsMetrics, type RegistrationApplicationStatus } from '@mms/shared';
import { registrationApplications, sessionClasses, sessions } from '../schema.js';
import type { TenantTransaction } from '../tenant-context.js';

const a = registrationApplications;

/** Application row joined with its session/class (eligibility is recomputed from the class rules). */
export interface ApplicationJoinedRow {
  id: string; reference: string; linkId: string; sessionId: string; sessionName: string; sessionStatus: string; sessionStartDate: string | null;
  classId: string; className: string; classGender: string; classMinAge: number; classMaxAge: number; classAgeCalcDate: string | null;
  preferredSectionId: string | null; fullName: string; guardianName: string; dateOfBirth: string; gender: string; phone: string;
  email: string | null; address: string | null; previousMadrasa: string | null; status: string; studentId: string | null;
  enrollmentId: string | null; reviewReason: string | null; reviewedAt: Date | null; createdAt: Date;
}

const joinedColumns = {
  id: a.id, reference: a.reference, linkId: a.linkId, sessionId: a.sessionId, sessionName: sessions.name, sessionStatus: sessions.status,
  sessionStartDate: sessions.startDate, classId: a.classId, className: sessionClasses.name, classGender: sessionClasses.gender,
  classMinAge: sessionClasses.ageMin, classMaxAge: sessionClasses.ageMax, classAgeCalcDate: sessionClasses.ageCalculationDate,
  preferredSectionId: a.preferredSectionId, fullName: a.fullName, guardianName: a.guardianName, dateOfBirth: a.dateOfBirth,
  gender: a.gender, phone: a.phone, email: a.email, address: a.address, previousMadrasa: a.previousMadrasa, status: a.status,
  studentId: a.studentId, enrollmentId: a.enrollmentId, reviewReason: a.reviewReason, reviewedAt: a.reviewedAt, createdAt: a.createdAt,
};

function joinedFrom(tx: TenantTransaction) {
  return tx.select(joinedColumns).from(a)
    .innerJoin(sessions, and(eq(sessions.workspaceSubdomain, a.workspaceSubdomain), eq(sessions.id, a.sessionId)))
    .innerJoin(sessionClasses, and(eq(sessionClasses.workspaceSubdomain, a.workspaceSubdomain), eq(sessionClasses.id, a.classId)));
}

export interface ApplicationListFilter {
  sessionId?: string;
  status?: RegistrationApplicationStatus;
  search?: string;
  page: number;
  limit: number;
}

export async function listApplicationsTx(tx: TenantTransaction, subdomain: string, filter: ApplicationListFilter): Promise<{ rows: ApplicationJoinedRow[]; total: number }> {
  const conditions: SQL[] = [eq(a.workspaceSubdomain, subdomain), isNull(a.deletedAt)];
  if (filter.sessionId) conditions.push(eq(a.sessionId, filter.sessionId));
  if (filter.status) conditions.push(eq(a.status, filter.status));
  if (filter.search) {
    const pattern = toSqlSearchPattern(filter.search);
    const match = or(ilike(a.fullName, pattern), ilike(a.guardianName, pattern), ilike(a.phone, pattern), ilike(a.reference, pattern));
    if (match) conditions.push(match);
  }
  const where = and(...conditions);
  const rows = await joinedFrom(tx).where(where).orderBy(desc(a.createdAt)).limit(filter.limit).offset((filter.page - 1) * filter.limit);
  const [count] = await tx.select({ total: sql<number>`count(*)::int` }).from(a).where(where);
  return { rows, total: Number(count?.total ?? 0) };
}

export async function findApplicationsByIdsTx(tx: TenantTransaction, subdomain: string, ids: string[]): Promise<ApplicationJoinedRow[]> {
  if (ids.length === 0) return [];
  return joinedFrom(tx).where(and(eq(a.workspaceSubdomain, subdomain), inArray(a.id, ids), isNull(a.deletedAt)));
}

export async function countLinkSubmissionsTx(tx: TenantTransaction, subdomain: string, linkId: string): Promise<number> {
  const [row] = await tx.select({ total: sql<number>`count(*)::int` }).from(a)
    .where(and(eq(a.workspaceSubdomain, subdomain), eq(a.linkId, linkId), isNull(a.deletedAt)));
  return Number(row?.total ?? 0);
}

export async function admissionsMetricsTx(tx: TenantTransaction, subdomain: string, sessionId?: string): Promise<AdmissionsMetrics> {
  const scope = sessionId ? and(eq(a.workspaceSubdomain, subdomain), isNull(a.deletedAt), eq(a.sessionId, sessionId)) : and(eq(a.workspaceSubdomain, subdomain), isNull(a.deletedAt));
  const [row] = await tx.select({
    submitted: sql<number>`count(*)::int`,
    underReview: sql<number>`count(*) FILTER (WHERE ${a.status} IN ('submitted', 'under_review'))::int`,
    waitlisted: sql<number>`count(*) FILTER (WHERE ${a.status} = 'waitlisted')::int`,
    approved: sql<number>`count(*) FILTER (WHERE ${a.status} = 'approved')::int`,
    rejected: sql<number>`count(*) FILTER (WHERE ${a.status} = 'rejected')::int`,
    enrolled: sql<number>`count(*) FILTER (WHERE ${a.enrollmentId} IS NOT NULL)::int`,
  }).from(a).where(scope);
  return {
    submitted: Number(row?.submitted ?? 0), underReview: Number(row?.underReview ?? 0), waitlisted: Number(row?.waitlisted ?? 0),
    approved: Number(row?.approved ?? 0), rejected: Number(row?.rejected ?? 0), enrolled: Number(row?.enrolled ?? 0),
  };
}

export interface ApplicationDecision {
  status: RegistrationApplicationStatus;
  reviewReason?: string | null;
  reviewedBy?: string | null;
  studentId?: string | null;
  enrollmentId?: string | null;
}

export async function updateApplicationTx(tx: TenantTransaction, subdomain: string, id: string, decision: ApplicationDecision): Promise<void> {
  await tx.update(a)
    .set({ ...decision, reviewedAt: decision.reviewedBy ? new Date() : undefined, updatedAt: new Date() })
    .where(and(eq(a.workspaceSubdomain, subdomain), eq(a.id, id)));
}

/** Students that look like the applicant (same phone or same name + date of birth) for staff matching. */
export async function findMatchingStudentIdsTx(tx: TenantTransaction, subdomain: string, rows: ReadonlyArray<{ id: string; phone: string; fullName: string; dateOfBirth: string }>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (rows.length === 0) return out;
  const result = await tx.execute<{ applicationId: string; studentId: string }>(sql`
    SELECT DISTINCT ON (ra.id) ra.id AS "applicationId", st.id AS "studentId"
      FROM registration_applications ra
      JOIN contacts c ON c.workspace_subdomain = ra.workspace_subdomain AND c.deleted_at IS NULL
       AND (EXISTS (SELECT 1 FROM contact_phones cp
                     WHERE cp.workspace_subdomain = c.workspace_subdomain AND cp.contact_id = c.id
                       AND right(regexp_replace(cp.number, '[^0-9]', '', 'g'), 10) = right(regexp_replace(ra.phone, '[^0-9]', '', 'g'), 10))
            OR (lower(btrim(c.name)) = lower(btrim(ra.full_name)) AND c.dob = ra.date_of_birth))
      JOIN students st ON st.workspace_subdomain = c.workspace_subdomain AND st.contact_id = c.id AND st.deleted_at IS NULL
     WHERE ra.workspace_subdomain = ${subdomain} AND ra.id IN (${sql.join(rows.map((row) => sql`${row.id}`), sql`, `)})
     ORDER BY ra.id, st.created_at`);
  for (const row of result.rows) out.set(row.applicationId, row.studentId);
  return out;
}

export interface NewApplication {
  id: string; reference: string; linkId: string; sessionId: string; classId: string; preferredSectionId: string | null;
  fullName: string; guardianName: string; dateOfBirth: string; gender: string; phone: string; email: string | null;
  address: string | null; previousMadrasa: string | null; status: RegistrationApplicationStatus; submittedIpHash: string | null;
}

export async function insertApplicationTx(tx: TenantTransaction, subdomain: string, row: NewApplication): Promise<void> {
  await tx.insert(a).values({ ...row, workspaceSubdomain: subdomain });
}
