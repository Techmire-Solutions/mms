import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { randomUUID } from "node:crypto";
import { examMarksImportBodySchema, resourceIdParamsSchema } from "@mms/shared";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import {
  sendDatabaseError,
  sendForbidden,
  sendIfHttpDomainError,
  sendServiceUnavailable,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import {
  BackgroundJobLimitError,
  enqueueBackgroundJob,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
  hasBackgroundJobRunner,
  QueueUnavailableError,
  retryFailedBackgroundJob,
} from "../../../services/backgroundJobWorkerService.js";
import { findLiveBackgroundJobForEntity } from "../../../services/backgroundJobService.js";
import { buildBackgroundJobId, buildDeterministicJobKey } from "../../../lib/backgroundJobIds.js";
import { examinationsUseCases } from "../../../examinations/use-cases/examinationsUseCases.js";
import { assertMarksImportScope } from "../../../examinations/use-cases/examMarksImportScope.js";
import { recordAuditEventSafely } from "../../../services/auditTrailService.js";

const COLLECTION = "exams";

/** Marks-state fingerprint for the export key; a read failure must not block an export. */
async function loadExportFingerprint(examId: string): Promise<Record<string, unknown>> {
  try {
    const fingerprint = await examinationsUseCases.loadExamResultsFingerprint(examId);
    return { count: fingerprint.count, maxUpdatedAt: fingerprint.maxUpdatedAt };
  } catch {
    return { count: -1, maxUpdatedAt: randomUUID() };
  }
}

/**
 * Marks are personal data: a broadsheet download is an access event. Best-effort (read-side), so a
 * transient audit failure never blocks a legitimate export — the same convention as other reads.
 */
async function auditBroadsheetExport(
  user: User,
  tenant: string,
  examId: string,
  includeInternal: boolean,
  jobId: string,
): Promise<void> {
  await recordAuditEventSafely({
    workspaceSubdomain: tenant,
    tableName: "exam_results",
    recordId: examId,
    actionType: "VIEW",
    realUserId: String(user.id),
    newState: {
      reasonCode: "broadsheet_export",
      examId,
      includeInternal,
      jobId,
    },
  });
}

/**
 * Marks transfer routes: a per-exam CSV import and a broadsheet export.
 *
 * Both are queued (never synchronous): the import resolves each row's roll number against the
 * exam roster and the export streams one exam's marks. The route only validates, authorises and
 * enqueues; the worker owns the actual work, progress and the artifact.
 */
export const examinationMarksTransferRoutes: FastifyPluginAsync = async (fastify) => {
  const loadExam = async (id: string) => examinationsUseCases.loadExamById(id, true);

  fastify.post(
    "/exams/:id/results/import",
    { bodyLimit: 2 * 1024 * 1024 },
    async (request, reply) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
      if (!hasBackgroundJobRunner("examinations:marks-import")) {
        return sendServiceUnavailable(reply, "Marks import is not available on this deployment");
      }
      const parsed = parseRequest(examMarksImportBodySchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);

      const tenant = getRequestTenant();
      if (!tenant) return sendForbidden(reply);
      const params = parseRequest(resourceIdParamsSchema, request.params);
      if (!params.ok) return replyValidationError(reply, params.message);
      const examId = params.data.id;
      let exam;
      try {
        exam = await loadExam(examId);
      } catch (error) {
        const mapped = sendIfHttpDomainError(reply, error);
        if (mapped) return mapped;
        return sendDatabaseError(reply, "Failed to load the exam", error);
      }
      if (!exam) return reply.status(404).send({ type: "not_found", message: "Exam not found" });
      if (exam.resultsFinalizedAt) {
        return reply.status(409).send({
          type: "exam_results_finalized",
          message: "Results are published — unpublish them before importing marks",
        });
      }
      try {
        // The importer is a writer: it obeys the same exact-section staffing rule as the grid
        // save, resolved from the rolls being imported (the worker re-runs the attendance gate).
        await assertMarksImportScope(user, tenant, examId, parsed.data.rows);
      } catch (error) {
        const mapped = sendIfHttpDomainError(reply, error);
        if (mapped) return mapped;
        return sendDatabaseError(reply, "Failed to authorise the marks import", error);
      }

      const label =
        parsed.data.label?.trim() || `Importing ${parsed.data.rows.length} marks into ${exam.name}`;
      const userId = String(user.id);
      const idempotencyKey =
        parsed.data.idempotencyKey ??
        buildDeterministicJobKey({
          moduleId: "examinations",
          kind: "marks-import",
          payload: { examId, rows: parsed.data.rows },
        });
      const jobId = buildBackgroundJobId(tenant, userId, idempotencyKey);

      const clientKey = parsed.data.idempotencyKey?.trim();
      const existing = await getUserBackgroundJob(userId, jobId);
      if (existing) {
        const importPayload = { examId, rows: parsed.data.rows, label };
        if (existing.status === "failed") {
          return reply
            .status(202)
            .send({ job: await retryFailedBackgroundJob(tenant, userId, existing, importPayload) });
        }
        const stored = await getUserBackgroundJobPayload(userId, jobId, tenant);
        if (stored && stored.examId !== undefined) {
          const mismatch =
            stored.examId !== examId ||
            JSON.stringify(stored.rows) !== JSON.stringify(parsed.data.rows);
          if (mismatch) {
            return reply.status(409).send({
              type: "exam_marks_import_conflict",
              message:
                "This idempotency key was already used for a different exam or row set — start a new import",
            });
          }
        } else if (clientKey && existing.status === "completed") {
          return reply.status(409).send({
            type: "exam_marks_import_conflict",
            message:
              "This idempotency key belongs to a finished import whose rows were discarded — start a new import with a new key",
          });
        }
        return reply.status(202).send({ job: existing });
      }

      // One import per exam at a time: concurrent imports churn OCC stale_write errors and
      // duplicate work. The check is tenant-wide (a co-teacher importing the same exam counts).
      const live = await findLiveBackgroundJobForEntity(
        "examinations",
        "marks-import",
        "examId",
        examId,
      );
      if (live) {
        return reply.status(409).send({
          type: "exam_marks_import_in_progress",
          message: "A marks import for this exam is already running — wait for it to finish",
          details: { jobId: live.id },
        });
      }

      try {
        const job = await enqueueBackgroundJob(
          tenant,
          userId,
          {
            id: jobId,
            moduleId: "examinations",
            kind: "marks-import",
            status: "running",
            label,
            createdAt: new Date().toISOString(),
          },
          { examId, rows: parsed.data.rows, label },
        );
        return reply.status(202).send({ job });
      } catch (error) {
        if (error instanceof BackgroundJobLimitError) {
          return reply.status(429).send({ type: "background_job_limit", message: error.message });
        }
        if (error instanceof QueueUnavailableError) {
          return sendServiceUnavailable(reply, error.message);
        }
        throw error;
      }
    },
  );

  fastify.post("/exams/:id/results/export", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    if (!hasBackgroundJobRunner("examinations:results-export")) {
      return sendServiceUnavailable(reply, "Marks export is not available on this deployment");
    }
    const tenant = getRequestTenant();
    if (!tenant) return sendForbidden(reply);
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const examId = params.data.id;
    let exam;
    try {
      exam = await loadExam(examId);
    } catch (error) {
      const mapped = sendIfHttpDomainError(reply, error);
      if (mapped) return mapped;
      return sendDatabaseError(reply, "Failed to load the exam", error);
    }
    // The broadsheet obeys the same publication boundary as `GET /results`: a caller who cannot
    // grade may only export published marks, and an unpublished exam is indistinguishable from a
    // missing one. Graders keep the full sheet (they already see drafts in the grid).
    const includeInternal = canWriteCollection(user, COLLECTION);
    if (!exam || (!includeInternal && !exam.resultsFinalizedAt)) {
      return reply.status(404).send({ type: "not_found", message: "Exam not found" });
    }

    const userId = String(user.id);
    // The key includes the marks state: a double click dedupes, but an export requested after a
    // correction produces a fresh artifact instead of the stale one.
    const fingerprint = await loadExportFingerprint(examId);
    const exportPayload = {
      examId,
      includeInternal,
      fingerprint,
      label: `Exported marks for ${exam.name}`,
    };
    const idempotencyKey = buildDeterministicJobKey({
      moduleId: "examinations",
      kind: "results-export",
      payload: exportPayload,
    });
    const jobId = buildBackgroundJobId(tenant, userId, idempotencyKey);
    const existing = await getUserBackgroundJob(userId, jobId);
    if (existing) {
      const job =
        existing.status === "failed"
          ? await retryFailedBackgroundJob(tenant, userId, existing, exportPayload)
          : existing;
      await auditBroadsheetExport(user, tenant, examId, includeInternal, job.id);
      return reply.status(202).send({ job });
    }

    try {
      const job = await enqueueBackgroundJob(
        tenant,
        userId,
        {
          id: jobId,
          moduleId: "examinations",
          kind: "results-export",
          status: "running",
          label: `Exporting marks for ${exam.name}`,
          createdAt: new Date().toISOString(),
        },
        exportPayload,
      );
      await auditBroadsheetExport(user, tenant, examId, includeInternal, job.id);
      return reply.status(202).send({ job });
    } catch (error) {
      if (error instanceof BackgroundJobLimitError) {
        return reply.status(429).send({ type: "background_job_limit", message: error.message });
      }
      if (error instanceof QueueUnavailableError) {
        return sendServiceUnavailable(reply, error.message);
      }
      throw error;
    }
  });
};
