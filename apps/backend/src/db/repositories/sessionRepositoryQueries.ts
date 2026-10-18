import { and, eq, inArray, isNull } from 'drizzle-orm';
import { type Session } from '@mms/shared';
import { sessions, sessionClasses } from '../schema.js';
import { withTenantRead, type TenantTransaction } from '../tenant-context.js';
import { hydrateSessionsList, hydrateSessionsListSummary } from './sessionRepositoryHydrate.js';
import { getPreparedSessionById } from '../preparedStatements.js';
import { attachClassSectionsTx } from './sessionSectionsHydrate.js';
import { attachSessionWorkingDaysTx } from './sessionWorkingDays.js';

async function attachSessionChildrenTx(tx: TenantTransaction, subdomain: string, list: Session[]): Promise<Session[]> {
  return attachSessionWorkingDaysTx(tx, subdomain, await attachClassSectionsTx(tx, subdomain, list));
}

export const sessionSelectColumns = {
  id: sessions.id,
  workspaceSubdomain: sessions.workspaceSubdomain,
  name: sessions.name,
  type: sessions.type,
  categoryId: sessions.categoryId,
  programId: sessions.programId,
  status: sessions.status,
  startDate: sessions.startDate,
  endDate: sessions.endDate,
  baseFee: sessions.baseFee,
  currency: sessions.currency,
  description: sessions.description,
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
    if (!tx || typeof (tx as { select?: unknown }).select !== 'function') return null;
    let rows: (typeof sessions.$inferSelect)[];
    if (process.env.MMS_USE_PREPARED_STATEMENTS !== 'false' && typeof (tx as { execute?: unknown }).execute === 'function') {
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
    const [result] = await attachSessionChildrenTx(tx, subdomain, await hydrateSessionsList(tx, subdomain, rows));
    return result ?? null;
  });
}

export async function findSessionsByIds(tenant: string, ids: string[]): Promise<Session[]> {
  if (ids.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    if (!tx || typeof (tx as { select?: unknown }).select !== 'function') return [];
    const rows = await tx
      .select(sessionSelectColumns)
      .from(sessions)
      .where(and(eq(sessions.workspaceSubdomain, subdomain), inArray(sessions.id, ids)));
    return attachSessionChildrenTx(tx, subdomain, await hydrateSessionsList(tx, subdomain, rows));
  });
}

export async function findSessionsSummaryByIds(
  tenant: string,
  ids: string[],
): Promise<Session[]> {
  if (ids.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(sessionSelectColumns)
      .from(sessions)
      .where(and(eq(sessions.workspaceSubdomain, subdomain), inArray(sessions.id, ids)));
    return attachSessionChildrenTx(tx, subdomain, await hydrateSessionsListSummary(tx, subdomain, rows));
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
    if (!tx || typeof (tx as { select?: unknown }).select !== 'function') return [];
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
      .where(and(eq(sessionClasses.workspaceSubdomain, subdomain), inArray(sessionClasses.id, ids)));
  });
}

export async function findClassById(
  tenant: string,
  id: string,
): Promise<{ id: string; deletedAt?: unknown } | null> {
  const [result] = await findClassesByIds(tenant, [id]);
  return result ?? null;
}
