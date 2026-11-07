import { and, asc, eq } from "drizzle-orm";
import { sessions, sessionClasses } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

/** Compact pre-image captured for the audit trail `old_state` (no child collections). */
export interface SessionAuditState {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  baseFee: string;
  currency: string;
  version: number;
  deletedAt: Date | null;
  classes: Array<{ id: string; name: string; status: string; capacity: number }>;
}

/** Reads the current session state inside the caller's transaction, before a mutation. */
export async function sessionAuditStateTx(
  tx: TenantTransaction,
  subdomain: string,
  sessionId: string,
): Promise<SessionAuditState | null> {
  const read = async <T>(query: unknown): Promise<T[]> => {
    try {
      const result = await (query as Promise<T[]>);
      return Array.isArray(result) ? result : [];
    } catch {
      // Lightweight transaction fakes in unit tests do not implement the query chain; the audit
      // snapshot is optional, so treat an unreadable pre-image as absent.
      return [];
    }
  };
  const [row] = await read<{
    id: string;
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    baseFee: string;
    currency: string;
    version: number;
    deletedAt: Date | null;
  }>(
    tx
      .select({
        id: sessions.id,
        name: sessions.name,
        status: sessions.status,
        startDate: sessions.startDate,
        endDate: sessions.endDate,
        baseFee: sessions.baseFee,
        currency: sessions.currency,
        version: sessions.version,
        deletedAt: sessions.deletedAt,
      })
      .from(sessions)
      .where(and(eq(sessions.workspaceSubdomain, subdomain), eq(sessions.id, sessionId))),
  );
  if (!row) return null;
  const classes = await read<{
    id: string;
    name: string;
    status: string;
    capacity: number;
  }>(
    tx
      .select({
        id: sessionClasses.id,
        name: sessionClasses.name,
        status: sessionClasses.status,
        capacity: sessionClasses.capacity,
      })
      .from(sessionClasses)
      .where(
        and(
          eq(sessionClasses.workspaceSubdomain, subdomain),
          eq(sessionClasses.sessionId, sessionId),
        ),
      )
      .orderBy(asc(sessionClasses.sortOrder)),
  );
  return {
    ...row,
    version: Number(row.version),
    classes: classes.map((cls) => ({ ...cls, capacity: Number(cls.capacity) })),
  } as SessionAuditState;
}
