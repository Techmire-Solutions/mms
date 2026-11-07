import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { type Session } from "@mms/shared";
import { sessions, sessionClasses, type SessionReadRow } from "../schema.js";
import { withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { hydrateSessionsList, hydrateSessionsListSummary } from "./sessionRepositoryHydrate.js";
import { getPreparedSessionById } from "../preparedStatements.js";
import { attachClassSectionsTx } from "./sessionSectionsHydrate.js";
import { attachSessionWorkingDaysTx } from "./sessionWorkingDays.js";
import { sessionTypeSql } from "./academicCatalogNameSql.js";
import { toDbDate } from "../../lib/dbDate.js";

async function attachSessionChildrenTx(
  tx: TenantTransaction,
  subdomain: string,
  list: Session[],
): Promise<Session[]> {
  return attachSessionWorkingDaysTx(
    tx,
    subdomain,
    await attachClassSectionsTx(tx, subdomain, list),
  );
}

const sessionSelectColumns = {
  id: sessions.id,
  workspaceSubdomain: sessions.workspaceSubdomain,
  name: sessions.name,
  type: sessionTypeSql,
  categoryId: sessions.categoryId,
  programId: sessions.programId,
  status: sessions.status,
  startDate: sessions.startDate,
  endDate: sessions.endDate,
  baseFee: sessions.baseFee,
  currency: sessions.currency,
  description: sessions.description,
  minAttendancePct: sessions.minAttendancePct,
  requiresExamPass: sessions.requiresExamPass,
  version: sessions.version,
  overlapExempt: sessions.overlapExempt,
  deletedAt: sessions.deletedAt,
  deletedBy: sessions.deletedBy,
  deletionReason: sessions.deletionReason,
  restoredAt: sessions.restoredAt,
  restoredBy: sessions.restoredBy,
  deletedWithCascade: sessions.deletedWithCascade,
  createdAt: sessions.createdAt,
  updatedAt: sessions.updatedAt,
} as const;

export async function listSessionsByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<Session[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const baseQuery = tx
      .select(sessionSelectColumns)
      .from(sessions)
      .where(and(eq(sessions.workspaceSubdomain, subdomain), isNull(sessions.deletedAt)))
      .orderBy(sessions.startDate);
    if (options?.offset) {
      baseQuery.offset(Math.max(0, options.offset));
    }
    const rows = options?.limit
      ? await baseQuery.limit(Math.min(Math.max(1, options.limit), 5000))
      : await baseQuery;
    return attachSessionChildrenTx(tx, subdomain, await hydrateSessionsList(tx, subdomain, rows));
  });
}

export async function findSessionById(tenant: string, id: string): Promise<Session | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    if (!tx || typeof (tx as { select?: unknown }).select !== "function") return null;
    let rows: SessionReadRow[];
    if (
      process.env.MMS_USE_PREPARED_STATEMENTS !== "false" &&
      typeof (tx as { execute?: unknown }).execute === "function"
    ) {
      try {
        const stmt = getPreparedSessionById(tx);
        rows = await stmt.execute({ subdomain, id });
      } catch {
        rows = await tx
          .select(sessionSelectColumns)
          .from(sessions)
          .where(and(eq(sessions.workspaceSubdomain, subdomain), eq(sessions.id, id)));
      }
    } else {
      rows = await tx
        .select(sessionSelectColumns)
        .from(sessions)
        .where(and(eq(sessions.workspaceSubdomain, subdomain), eq(sessions.id, id)));
    }
    const row = rows[0];
    if (!row) return null;
    const [result] = await attachSessionChildrenTx(
      tx,
      subdomain,
      await hydrateSessionsList(tx, subdomain, rows),
    );
    return result ?? null;
  });
}

export async function findSessionsByIds(tenant: string, ids: string[]): Promise<Session[]> {
  if (ids.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    if (!tx || typeof (tx as { select?: unknown }).select !== "function") return [];
    const rows = await tx
      .select(sessionSelectColumns)
      .from(sessions)
      .where(and(eq(sessions.workspaceSubdomain, subdomain), inArray(sessions.id, ids)));
    return attachSessionChildrenTx(tx, subdomain, await hydrateSessionsList(tx, subdomain, rows));
  });
}

/** Stored lifecycle status per id for a bulk transition (one query, no per-id transaction). */
export async function findSessionStatusesByIds(
  tenant: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: sessions.id, status: sessions.status })
      .from(sessions)
      .where(and(eq(sessions.workspaceSubdomain, subdomain), inArray(sessions.id, ids)));
    return new Map(rows.map((row) => [row.id, row.status]));
  });
}

export interface OverlappingSessionSummary {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

/**
 * Live sessions of the tenant whose inclusive range intersects `[startDate, endDate]`.
 * Backs the friendly 409 in the use-cases; the authoritative guarantee is the
 * `sessions_no_overlap_excl` exclusion constraint (migration 0206).
 */
export async function findOverlappingSessions(
  tenant: string,
  input: { startDate?: string | null; endDate?: string | null; excludeId?: string },
): Promise<OverlappingSessionSummary[]> {
  const subdomain = tenant.trim().toLowerCase();
  const start = toDbDate(input.startDate);
  const end = toDbDate(input.endDate);
  if (!start || !end) return [];
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [
      eq(sessions.workspaceSubdomain, subdomain),
      isNull(sessions.deletedAt),
      eq(sessions.overlapExempt, false),
      inArray(sessions.status, ["draft", "open", "in_progress"]),
      isNotNull(sessions.startDate),
      isNotNull(sessions.endDate),
      sql`daterange(${sessions.startDate}, ${sessions.endDate}, '[]') && daterange(${start}::date, ${end}::date, '[]')`,
    ];
    if (input.excludeId) conditions.push(ne(sessions.id, input.excludeId));
    return tx
      .select({
        id: sessions.id,
        name: sessions.name,
        startDate: sessions.startDate,
        endDate: sessions.endDate,
        status: sessions.status,
      })
      .from(sessions)
      .where(and(...conditions));
  });
}

export async function findSessionsSummaryByIds(tenant: string, ids: string[]): Promise<Session[]> {
  if (ids.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(sessionSelectColumns)
      .from(sessions)
      .where(and(eq(sessions.workspaceSubdomain, subdomain), inArray(sessions.id, ids)));
    return attachSessionChildrenTx(
      tx,
      subdomain,
      await hydrateSessionsListSummary(tx, subdomain, rows),
    );
  });
}

/** Session classes by id (archived when their session is archived). Session ids are not accepted. */
export async function findClassesByIds(
  tenant: string,
  ids: string[],
): Promise<{ id: string; deletedAt?: unknown }[]> {
  if (ids.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    if (!tx || typeof (tx as { select?: unknown }).select !== "function") return [];
    return tx
      .select({ id: sessionClasses.id, deletedAt: sessions.deletedAt })
      .from(sessionClasses)
      .innerJoin(
        sessions,
        and(
          eq(sessions.workspaceSubdomain, sessionClasses.workspaceSubdomain),
          eq(sessions.id, sessionClasses.sessionId),
        ),
      )
      .where(
        and(eq(sessionClasses.workspaceSubdomain, subdomain), inArray(sessionClasses.id, ids)),
      );
  });
}

export async function findClassById(
  tenant: string,
  id: string,
): Promise<{ id: string; deletedAt?: unknown } | null> {
  const [result] = await findClassesByIds(tenant, [id]);
  return result ?? null;
}
