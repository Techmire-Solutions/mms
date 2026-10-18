import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { type Class } from '@mms/shared';
import { randomUUID } from 'node:crypto';
import { sessionClasses, enrollments, examClasses } from '../schema.js';
import { type TenantTransaction } from '../tenant-context.js';
import { ConflictError } from '../../lib/httpErrors.js';
import { persistClassSectionsTx } from './sessionRepositorySections.js';
import { hasClassReferencesTx } from './sessionClassReferenceGuard.js';
import {
  collectClassChildRows,
  deleteClassChildrenTx,
  emptyClassChildRows,
  insertClassChildRowsTx,
} from './sessionRepositoryClassChildren.js';
import { toDbDate } from '../../lib/dbDate.js';

type Transaction = TenantTransaction;

/**
 * Rejects removing classes that are still referenced — enrollments, attendance (archived rows too,
 * since the FK restricts), exams, fee structures, hasanat distributions or question papers.
 */
async function assertClassesRemovableTx(tx: Transaction, subdomain: string, classIds: string[]): Promise<void> {
  if (classIds.length === 0) return;
  if (await hasClassReferencesTx(tx, subdomain, classIds)) {
    throw new ConflictError('Cannot remove a class that has enrollments, attendance, exams or fee structures');
  }
  const [enrolled] = await tx
    .select({ id: enrollments.id })
    .from(enrollments)
    // Archived enrollments still hold the (deferred) composite FK, so they block removal too.
    .where(and(eq(enrollments.workspaceSubdomain, subdomain), inArray(enrollments.classId, classIds)))
    .limit(1);
  const [examined] = await tx
    .select({ examId: examClasses.examId })
    .from(examClasses)
    .where(and(eq(examClasses.workspaceSubdomain, subdomain), inArray(examClasses.classId, classIds)))
    .limit(1);
  if (enrolled || examined) {
    throw new ConflictError('Cannot remove a class that has enrollments, attendance, or exams');
  }
}

/**
 * Persists a session's classes by id: upserts classes present in the payload, replaces their
 * child collections, and deletes only classes missing from the payload (guarded against dependants).
 * `classes === undefined` leaves existing classes untouched.
 */
export async function persistSessionClassesTx(
  tx: Transaction,
  subdomain: string,
  sessionId: string,
  classes?: Class[],
): Promise<void> {
  if (classes === undefined) return;

  const payload = classes.map((c) => ({ ...c, id: c.id || randomUUID() }));
  const keptIds = payload.map((c) => c.id);
  const sessionScope = and(eq(sessionClasses.workspaceSubdomain, subdomain), eq(sessionClasses.sessionId, sessionId));

  const removed = await tx
    .select({ id: sessionClasses.id })
    .from(sessionClasses)
    .where(keptIds.length > 0 ? and(sessionScope, notInArray(sessionClasses.id, keptIds)) : sessionScope);
  const removedIds = removed.map((r) => r.id);

  await assertClassesRemovableTx(tx, subdomain, removedIds);
  await deleteClassChildrenTx(tx, subdomain, [...removedIds, ...keptIds]);
  if (removedIds.length > 0) {
    // Removed (unused) classes cascade to their sections' staff history, which is soft-delete guarded.
    await tx.execute(sql`SELECT set_config('app.allow_hard_purge', 'true', true)`);
    await tx.delete(sessionClasses).where(and(sessionScope, inArray(sessionClasses.id, removedIds)));
  }

  const childRows = emptyClassChildRows();
  for (let idx = 0; idx < payload.length; idx++) {
    const c = payload[idx];
    const values = {
      sessionId,
      name: c.name,
      gender: c.gender || 'mixed',
      ageCalculationDate: toDbDate(c.ageCalculationDate),
      ageMin: c.minAge ?? 4,
      ageMax: c.maxAge ?? 25,
      // Class capacity is the sum of its sections when sections are sent.
      capacity: c.sections?.length ? c.sections.reduce((total, section) => total + Math.max(0, section.capacity ?? 0), 0) : c.maxStudents ?? 30,
      enrollmentDeadline: c.enrollmentDeadline || '',
      status: c.status || 'active',
      facultyId: c.facultyId?.trim() ? c.facultyId.trim() : null,
      facultyName: c.facultyName || '',
      room: c.room || '',
      programId: c.programId || null,
      sortOrder: idx,
    };
    // `enrolled` is derived from enrollments on read; never trusted from the client.
    await tx
      .insert(sessionClasses)
      .values({ id: c.id, workspaceSubdomain: subdomain, enrolled: 0, ...values })
      .onConflictDoUpdate({
        target: [sessionClasses.workspaceSubdomain, sessionClasses.sessionId, sessionClasses.id],
        set: values,
      });
    await persistClassSectionsTx(tx, { subdomain, sessionId, classId: c.id, capacity: values.capacity, room: values.room }, c.sections);
    collectClassChildRows(childRows, subdomain, c.id, c);
  }

  await insertClassChildRowsTx(tx, childRows);
}
