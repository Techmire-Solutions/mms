import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AcademicCatalogKind } from '@mms/shared';
import {
  exams,
  programs,
  sessionCategories,
  sessionClasses,
  sessionClassTimetablePeriods,
  sessions,
  subjects,
  type AcademicCatalogTable,
} from '../schema.js';
import type { TenantTransaction } from '../tenant-context.js';

const TABLES: Record<AcademicCatalogKind, AcademicCatalogTable> = {
  categories: sessionCategories,
  programs,
  subjects,
};

async function firstCount(query: PromiseLike<Array<{ n: number }>>): Promise<number> {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

/** Live rows (sessions, classes, timetable periods, exams) that point at a catalog entry. */
export async function countAcademicCatalogReferencesTx(
  tx: TenantTransaction,
  kind: AcademicCatalogKind,
  subdomain: string,
  id: string,
): Promise<number> {
  const n = sql<number>`count(*)::int`;
  if (kind === 'categories') {
    return firstCount(tx.select({ n }).from(sessions).where(and(
      eq(sessions.workspaceSubdomain, subdomain), eq(sessions.categoryId, id), isNull(sessions.deletedAt))));
  }
  if (kind === 'programs') {
    const inSessions = await firstCount(tx.select({ n }).from(sessions).where(and(
      eq(sessions.workspaceSubdomain, subdomain), eq(sessions.programId, id), isNull(sessions.deletedAt))));
    const inClasses = await firstCount(tx.select({ n }).from(sessionClasses).where(and(
      eq(sessionClasses.workspaceSubdomain, subdomain), eq(sessionClasses.programId, id))));
    return inSessions + inClasses;
  }
  const inPeriods = await firstCount(tx.select({ n }).from(sessionClassTimetablePeriods).where(and(
    eq(sessionClassTimetablePeriods.workspaceSubdomain, subdomain), eq(sessionClassTimetablePeriods.subjectId, id))));
  const inExams = await firstCount(tx.select({ n }).from(exams).where(and(
    eq(exams.workspaceSubdomain, subdomain), eq(exams.subjectId, id), isNull(exams.deletedAt))));
  return inPeriods + inExams;
}

/** id → name for live entries among `ids` (used to refresh display snapshots on write). */
export async function loadAcademicCatalogNamesTx(
  tx: TenantTransaction,
  kind: AcademicCatalogKind,
  subdomain: string,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const table = TABLES[kind];
  const rows = await tx.select({ id: table.id, name: table.name }).from(table).where(and(
    eq(table.workspaceSubdomain, subdomain), inArray(table.id, unique), isNull(table.deletedAt)));
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** Resolves a live entry id by system `code` (e.g. the default session category). */
export async function findAcademicCatalogIdByCodeTx(
  tx: TenantTransaction,
  kind: AcademicCatalogKind,
  subdomain: string,
  code: string,
): Promise<string | null> {
  const table = TABLES[kind];
  const [row] = await tx.select({ id: table.id }).from(table).where(and(
    eq(table.workspaceSubdomain, subdomain), eq(table.code, code), isNull(table.deletedAt))).limit(1);
  return row?.id ?? null;
}

/** Resolves a live entry by case-insensitive name (legacy text writes, CSV imports). */
export async function findAcademicCatalogByNameTx(
  tx: TenantTransaction,
  kind: AcademicCatalogKind,
  subdomain: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  if (!name.trim()) return null;
  const table = TABLES[kind];
  const [row] = await tx.select({ id: table.id, name: table.name }).from(table).where(and(
    eq(table.workspaceSubdomain, subdomain), isNull(table.deletedAt),
    sql`lower(btrim(${table.name})) = lower(btrim(${name}))`)).limit(1);
  return row ?? null;
}
