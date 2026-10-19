import {
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
import { NotFoundError } from "../../lib/httpErrors.js";

/** Facts → evaluated row (percentages rounded to one decimal). */
export function toCompletionRow(fact: CompletionFactRow, session: Session): SessionCompletionRow {
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

export function createSessionCompletionUseCases() {
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
      const session = await loadSession(tenant, sessionId);
      const evaluated = await rows(tenant, session);
      await repo.saveCompletionOutcomes(
        tenant,
        evaluated.map((row) => ({ enrollmentId: row.enrollmentId, status: row.status })),
      );
      await broadcastCollection("enrollments");
      return rows(tenant, session);
    },

    /** Marks certificates issued for completed enrollments (all of them when none are named). */
    async issueCertificates(
      tenant: string,
      sessionId: string,
      input: SessionCertificatesBody,
    ): Promise<{ issued: string[]; rows: SessionCompletionRow[] }> {
      const body = sessionCertificatesBodySchema.parse(input);
      const session = await loadSession(tenant, sessionId);
      const issued = await repo.markCertificatesIssued(tenant, session.id, body.enrollmentIds);
      if (issued.length > 0) await broadcastCollection("enrollments");
      return { issued, rows: await rows(tenant, session) };
    },
  };
}

export const sessionCompletionUseCases = createSessionCompletionUseCases();
