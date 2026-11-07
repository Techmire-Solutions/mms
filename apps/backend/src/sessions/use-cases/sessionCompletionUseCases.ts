import {
  canEvaluateSessionCompletion,
  canIssueSessionCertificates,
  completionGateViolations,
  evaluateCompletion,
  sessionCertificatesBodySchema,
  sessionCompletionActionBodySchema,
  type CompletionGateViolation,
  type Session,
  type SessionCertificatesBody,
  type SessionCompletionActionBody,
  type SessionCompletionRow,
} from "@mms/shared";
import { sessionsRepository } from "../repository/sessionsRepositoryAdapter.js";
import { sessionCompletionRepository as repo } from "../repository/sessionCompletionRepositoryAdapter.js";
import type { CompletionFactRow } from "../repository/sessionCompletionRepository.js";
import type { CompletionGateRow } from "../repository/sessionCompletionRepository.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { withTenant } from "../../db/tenant-context.js";
import { workspaceToday } from "./sessionLockGuard.js";
import { CompletionBlockedError } from "./sessionCompletionErrors.js";

/** Facts + gate rows → evaluated row (percentages rounded to one decimal). */
function toCompletionRow(
  fact: CompletionFactRow,
  gate: CompletionGateRow | undefined,
  session: Session,
): SessionCompletionRow {
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
    unmarkedDays: gate?.unmarkedDays ?? 0,
    unfinalizedExams: gate?.unfinalizedExams ?? 0,
    outstandingDues: gate?.outstandingDues ?? 0,
    stale: gate?.stale ?? false,
  };
}

async function loadSession(tenant: string, sessionId: string): Promise<Session> {
  const session = await sessionsRepository.findSessionById(tenant, sessionId);
  if (!session || session.deletedAt) throw new NotFoundError("Session not found");
  return session;
}

const hasCriteria = (session: Session): boolean =>
  (session.minAttendancePct ?? 0) > 0 || Boolean(session.requiresExamPass);

/** Gate violations for an action, from the aggregated rows. `evaluate` ignores finance. */
function actionGateViolations(
  rows: readonly SessionCompletionRow[],
  session: Session,
  action: "evaluate" | "certificates",
): CompletionGateViolation[] {
  const unmarkedDays = Math.max(0, ...rows.map((row) => row.unmarkedDays));
  const unfinalizedExams = Math.max(0, ...rows.map((row) => row.unfinalizedExams));
  const outstandingDues = rows.reduce((sum, row) => sum + row.outstandingDues, 0);
  const evaluationStale = rows.some((row) => row.stale);
  const violations = completionGateViolations({
    unmarkedDays,
    unfinalizedExams,
    criteriaConfigured: hasCriteria(session),
    outstandingDues: action === "certificates" ? outstandingDues : 0,
    evaluationStale: action === "certificates" ? evaluationStale : false,
  });
  return violations;
}

interface ActionOptions {
  canOverride?: boolean;
  reason?: string;
  acknowledge?: readonly CompletionGateViolation[];
  allowNoCriteria?: boolean;
}

/**
 * A gate blocks unless the caller acknowledged exactly that violation **and** holds the lock
 * override permission with a reason (the acknowledgement is audited with the action).
 */
function assertGatesClear(
  violations: readonly CompletionGateViolation[],
  options: ActionOptions,
): void {
  if (violations.length === 0) return;
  const acknowledged = new Set(options.acknowledge ?? []);
  const waived =
    options.canOverride === true &&
    (options.reason ?? "").trim().length >= 3 &&
    violations.every((violation) => acknowledged.has(violation));
  if (waived) return;
  throw new CompletionBlockedError(violations);
}

function createSessionCompletionUseCases() {
  const loadRows = async (tenant: string, session: Session): Promise<SessionCompletionRow[]> => {
    const [facts, gates] = await Promise.all([
      repo.loadSessionCompletionFacts(tenant, session.id),
      repo.loadCompletionGates(tenant, session.id),
    ]);
    const gatesById = new Map(gates.map((gate) => [gate.enrollmentId, gate]));
    return facts.map((fact) => toCompletionRow(fact, gatesById.get(fact.enrollmentId), session));
  };

  return {
    /** Current completion standing of every enrollment (nothing is written). */
    async list(tenant: string, sessionId: string): Promise<SessionCompletionRow[]> {
      return loadRows(tenant, await loadSession(tenant, sessionId));
    },

    /** Evaluates and stores completion for every enrollment of the session. */
    async evaluate(
      tenant: string,
      sessionId: string,
      input: SessionCompletionActionBody = {},
      options: { canOverride?: boolean } = {},
    ): Promise<SessionCompletionRow[]> {
      const body = sessionCompletionActionBodySchema.parse(input);
      return withTenant(tenant, async () => {
        const session = await loadSession(tenant, sessionId);
        assertCompletionWindow(session, await workspaceToday(tenant), "evaluate");
        const rows = await loadRows(tenant, session);
        const violations = actionGateViolations(rows, session, "evaluate").filter(
          (violation) => !(violation === "no_criteria" && body.allowNoCriteria === true),
        );
        assertGatesClear(violations, {
          ...options,
          acknowledge: body.acknowledge,
          reason: body.reason,
        });
        await repo.saveCompletionOutcomes(
          tenant,
          rows.map((row) => ({ enrollmentId: row.enrollmentId, status: row.status })),
          sessionId,
        );
        await repo.markCompletionEvaluated(tenant, sessionId);
        await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
        await broadcastCollection("enrollments");
        return loadRows(tenant, session);
      });
    },

    /** Marks certificates issued for completed enrollments (all of them when none are named). */
    async issueCertificates(
      tenant: string,
      sessionId: string,
      input: SessionCertificatesBody,
      options: { canOverride?: boolean } = {},
    ): Promise<{ issued: string[]; rows: SessionCompletionRow[] }> {
      const body = sessionCertificatesBodySchema.parse(input);
      return withTenant(tenant, async () => {
        const session = await loadSession(tenant, sessionId);
        assertCompletionWindow(session, await workspaceToday(tenant), "certificates");
        const rows = await loadRows(tenant, session);
        assertGatesClear(actionGateViolations(rows, session, "certificates"), {
          ...options,
          acknowledge: body.acknowledge ?? [],
          reason: body.reason,
        });
        const issued = await repo.markCertificatesIssued(tenant, session.id, body.enrollmentIds);
        if (issued.length > 0) {
          await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
          await broadcastCollection("enrollments");
        }
        return { issued, rows: await loadRows(tenant, session) };
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
