import {
  canEvaluateSessionCompletion,
  canIssueSessionCertificates,
  evaluateCompletion,
  sessionCertificatesBodySchema,
  type Session,
  type SessionCertificatesBody,
  type SessionCompletionRow,
} from "@mms/shared";
import { sessionsRepository } from "../repository/sessionsRepositoryAdapter.js";
import { sessionCompletionRepository as repo } from "../repository/sessionCompletionRepositoryAdapter.js";
import type { CompletionFactRow } from "../repository/sessionCompletionRepository.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { withTenant } from "../../db/tenant-context.js";
import { workspaceToday } from "./sessionLockGuard.js";

/** Facts → evaluated row (percentages rounded to one decimal). */
function toCompletionRow(fact: CompletionFactRow, session: Session): SessionCompletionRow {
  const attendancePct =
    fact.countableDays > 0 ? Math.round((fact.presentDays / fact.countableDays) * 1000) / 10 : null;
  const examsPassed = fact.examsTotal > 0 ? fact.examsPassed === fact.examsTotal : null;
  const { status, shortfalls } = evaluateCompletion(
    { attendancePct, examsPassed, examsComplete: fact.examsTaken >= fact.examsTotal },
    { minAttendancePct: session.minAttendancePct, requiresExamPass: session.requiresExamPass },
  );
  return {
    enrollmentId: fact.enrollmentId,
    studentId: fact.studentId,
    studentName: fact.studentName,
    className: fact.className,
    attendancePct,
    examsPassed,
    status,
    shortfalls,
    completedAt: fact.completedAt,
    certificateIssuedAt: fact.certificateIssuedAt,
  };
}

async function loadSession(tenant: string, sessionId: string): Promise<Session> {
  const session = await sessionsRepository.findSessionById(tenant, sessionId);
  if (!session || session.deletedAt) throw new NotFoundError("Session not found");
  return session;
}

function createSessionCompletionUseCases() {
  const rows = async (tenant: string, session: Session) =>
    (await repo.loadSessionCompletionFacts(tenant, session.id)).map((fact) =>
      toCompletionRow(fact, session),
    );

  return {
    /** Current completion standing of every enrollment (nothing is written). */
    async list(tenant: string, sessionId: string): Promise<SessionCompletionRow[]> {
      return rows(tenant, await loadSession(tenant, sessionId));
    },

    /** Evaluates and stores completion for every enrollment of the session. */
    async evaluate(tenant: string, sessionId: string): Promise<SessionCompletionRow[]> {
      return withTenant(tenant, async () => {
        const session = await loadSession(tenant, sessionId);
        assertCompletionWindow(session, await workspaceToday(tenant), "evaluate");
        const evaluated = await rows(tenant, session);
        await repo.saveCompletionOutcomes(
          tenant,
          evaluated.map((row) => ({ enrollmentId: row.enrollmentId, status: row.status })),
          sessionId,
        );
        await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
        await broadcastCollection("enrollments");
        return rows(tenant, session);
      });
    },

    /** Marks certificates issued for completed enrollments (all of them when none are named). */
    async issueCertificates(
      tenant: string,
      sessionId: string,
      input: SessionCertificatesBody,
    ): Promise<{ issued: string[]; rows: SessionCompletionRow[] }> {
      return withTenant(tenant, async () => {
        const body = sessionCertificatesBodySchema.parse(input);
        const session = await loadSession(tenant, sessionId);
        assertCompletionWindow(session, await workspaceToday(tenant), "certificates");
        const issued = await repo.markCertificatesIssued(tenant, session.id, body.enrollmentIds);
        if (issued.length > 0) {
          await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
          await broadcastCollection("enrollments");
        }
        return { issued, rows: await rows(tenant, session) };
      });
    },
  };
}

/**
 * Completion writes are final for a student's record, so they are held to the session window:
 * evaluation only on/after the last day (or once completed), certificates only for a completed,
 * ended session.
 */
function assertCompletionWindow(
  session: Session,
  today: string,
  action: "evaluate" | "certificates",
): void {
  const window = { status: session.status, endDate: session.endDate, today };
  if (action === "evaluate" && !canEvaluateSessionCompletion(window))
    throw new ConflictError(
      "Completion can only be evaluated on or after the session's last day (or once it is completed)",
    );
  if (action === "certificates" && !canIssueSessionCertificates(window))
    throw new ConflictError(
      "Certificates can only be issued after a completed session has reached its end date",
    );
}

export const sessionCompletionUseCases = createSessionCompletionUseCases();
