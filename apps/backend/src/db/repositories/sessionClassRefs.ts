import { and, eq } from 'drizzle-orm';
import { sessionClasses, sessions } from '../schema.js';
import type { TenantTransaction } from '../tenant-context.js';
import { ValidationError } from '../../lib/httpErrors.js';

/** A class reference with the display names other modules snapshot. */
export interface SessionClassRef {
  classId: string;
  className: string;
  sessionId: string;
  sessionName: string;
  programId: string | null;
}

/**
 * Resolves a class id for modules that reference classes (finance, hasanat, question bank).
 * Returns null for an empty id; 400 when the class does not exist or its session is archived.
 */
export async function loadSessionClassRefTx(tx: TenantTransaction, subdomain: string, classId: string | null | undefined): Promise<SessionClassRef | null> {
  if (!classId) return null;
  const [row] = await tx
    .select({
      classId: sessionClasses.id, className: sessionClasses.name, classProgramId: sessionClasses.programId,
      sessionId: sessions.id, sessionName: sessions.name, sessionProgramId: sessions.programId, deletedAt: sessions.deletedAt,
    })
    .from(sessionClasses)
    .innerJoin(sessions, and(eq(sessions.workspaceSubdomain, sessionClasses.workspaceSubdomain), eq(sessions.id, sessionClasses.sessionId)))
    .where(and(eq(sessionClasses.workspaceSubdomain, subdomain), eq(sessionClasses.id, classId)))
    .limit(1);
  if (!row || row.deletedAt) throw new ValidationError('Referenced class is archived or does not exist');
  return {
    classId: row.classId, className: row.className, sessionId: row.sessionId, sessionName: row.sessionName,
    programId: row.classProgramId ?? row.sessionProgramId ?? null,
  };
}
