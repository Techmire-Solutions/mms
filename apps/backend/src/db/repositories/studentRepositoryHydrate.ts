import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { type Student, type RepositoryListOptions } from '@mms/shared';
import { students, studentEnrolledSessions, type StudentSelectRow } from '../schema.js';
import { withTenantRead, type AppDb } from '../tenant-context.js';
import {
  enableIncludeDeleted,
  softDeleteFilterNeedsIncludeDeleted,
} from '../../lib/softDeleteHelpers.js';
import { buildTenantSoftDeleteConditions } from '../../services/genericRelationalService.js';
import { studentRowToRecord } from './studentRepositoryMappers.js';
import { getPreparedStudentById } from '../preparedStatements.js';
import { STUDENT_COLUMNS } from './studentRepositoryColumns.js';

export async function hydrateStudentsList(
  tx: AppDb,
  subdomain: string,
  rows: StudentSelectRow[],
): Promise<Student[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // P2-2: Fetch all session enrollments for the batch in a single query (replaces N+1 round-trip).
  const sessionRows = await (tx as Parameters<typeof tx.select>[0] extends undefined ? never : typeof tx)
    .select({
      studentId: studentEnrolledSessions.studentId,
      sessionId: studentEnrolledSessions.sessionId,
      sortOrder: studentEnrolledSessions.sortOrder,
    })
    .from(studentEnrolledSessions)
    .where(
      and(
        eq(studentEnrolledSessions.workspaceSubdomain, subdomain),
        inArray(studentEnrolledSessions.studentId, ids),
      ),
    );

  const sessionsByStudentId = new Map<string, Array<{ sessionId: string; sortOrder: number }>>();
  for (const id of ids) sessionsByStudentId.set(id, []);
  for (const row of sessionRows) {
    const list = sessionsByStudentId.get(row.studentId) ?? [];
    list.push({ sessionId: row.sessionId, sortOrder: row.sortOrder });
    sessionsByStudentId.set(row.studentId, list);
  }

  return rows.map((row) => studentRowToRecord(row, sessionsByStudentId.get(row.id) ?? []));
}

export type ListStudentsOptions = RepositoryListOptions;

export async function listStudentsByWorkspace(
  tenant: string,
  options?: ListStudentsOptions,
): Promise<Student[]> {
  const subdomain = tenant.trim().toLowerCase();
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? 'all' : 'active');
  return withTenantRead(subdomain, async (tx) => {
    if (softDeleteFilterNeedsIncludeDeleted(deletedFilter)) await enableIncludeDeleted(tx);
    const conditions = buildTenantSoftDeleteConditions(students, subdomain, deletedFilter);

    const baseQuery = tx
      .select(STUDENT_COLUMNS)
      .from(students)
      .where(and(...conditions))
      .orderBy(students.id);
    if (options?.offset) {
      baseQuery.offset(Math.max(0, options.offset));
    }
    const rows = options?.limit
      ? await baseQuery.limit(Math.min(Math.max(1, options.limit), 5000))
      : await baseQuery;
    return hydrateStudentsList(tx, subdomain, rows);
  });
}

export async function findStudentById(
  tenant: string,
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<Student | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    if (!tx || typeof (tx as { select?: unknown }).select !== 'function') return null;
    if (options?.includeDeleted) await enableIncludeDeleted(tx);
    let rows: StudentSelectRow[];
    if (process.env.MMS_USE_PREPARED_STATEMENTS !== 'false' && typeof (tx as { execute?: unknown }).execute === 'function') {
      try {
        const stmt = getPreparedStudentById(tx);
        rows = await stmt.execute({ subdomain, id });
      } catch {
        rows = await tx
          .select(STUDENT_COLUMNS)
          .from(students)
          .where(and(eq(students.workspaceSubdomain, subdomain), eq(students.id, id)))
          .limit(1);
      }
    } else {
      rows = await tx
        .select(STUDENT_COLUMNS)
        .from(students)
        .where(and(eq(students.workspaceSubdomain, subdomain), eq(students.id, id)))
        .limit(1);
    }
    if (rows.length === 0) return null;
    const hydrated = await hydrateStudentsList(tx, subdomain, rows);
    return hydrated[0] ?? null;
  });
}

export async function findStudentsByIds(
  tenant: string,
  ids: string[],
  options?: { includeDeleted?: boolean },
): Promise<Student[]> {
  const subdomain = tenant.trim().toLowerCase();
  if (ids.length === 0) return [];
  return withTenantRead(subdomain, async (tx) => {
    if (!tx || typeof (tx as { select?: unknown }).select !== 'function') return [];
    if (options?.includeDeleted) await enableIncludeDeleted(tx);
    const rows = await tx
      .select(STUDENT_COLUMNS)
      .from(students)
      .where(
        and(
          eq(students.workspaceSubdomain, subdomain),
          inArray(students.id, ids),
        ),
      );
    return hydrateStudentsList(tx, subdomain, rows);
  });
}

export async function resolveStudentsByIdentifiers(
  tenant: string,
  identifiers: string[],
  options?: { includeDeleted?: boolean },
): Promise<Student[]> {
  const subdomain = tenant.trim().toLowerCase();
  if (identifiers.length === 0) return [];
  return withTenantRead(subdomain, async (tx) => {
    if (!tx || typeof (tx as { select?: unknown }).select !== 'function') return [];
    if (options?.includeDeleted) await enableIncludeDeleted(tx);
    const rows = await tx
      .select(STUDENT_COLUMNS)
      .from(students)
      .where(
        and(
          eq(students.workspaceSubdomain, subdomain),
          or(
            inArray(students.id, identifiers),
            inArray(students.studentId, identifiers),
            inArray(students.grNumber, identifiers),
          ),
        ),
      );
    return hydrateStudentsList(tx, subdomain, rows);
  });
}

export async function countStudentsByWorkspace(
  tenant: string,
  options?: ListStudentsOptions,
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? 'all' : 'active');
  return withTenantRead(subdomain, async (tx) => {
    if (softDeleteFilterNeedsIncludeDeleted(deletedFilter)) await enableIncludeDeleted(tx);
    const conditions = buildTenantSoftDeleteConditions(students, subdomain, deletedFilter);

    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(and(...conditions));
    return Number(rows[0]?.count ?? 0);
  });
}
