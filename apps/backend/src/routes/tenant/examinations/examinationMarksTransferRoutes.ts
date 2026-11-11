import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { examMarksImportBodySchema } from "@mms/shared";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import { sendForbidden, sendServiceUnavailable } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  hasBackgroundJobRunner,
  QueueUnavailableError,
} from "../../../services/backgroundJobWorkerService.js";
import { buildBackgroundJobId, buildDeterministicJobKey } from "../../../lib/backgroundJobIds.js";
import { examinationsUseCases } from "../../../examinations/use-cases/examinationsUseCases.js";

const COLLECTION = "exams";

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
      const examId = String((request.params as { id?: string }).id ?? "").trim();
      const exam = await loadExam(examId);
      if (!exam) return reply.status(404).send({ type: "not_found", message: "Exam not found" });
      if (exam.resultsFinalizedAt) {
        return reply.status(409).send({
          type: "exam_results_finalized",
          message: "Results are published — unpublish them before importing marks",
        });
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

      const existing = await getUserBackgroundJob(userId, jobId);
      if (existing) return reply.status(202).send({ job: existing });

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
    const examId = String((request.params as { id?: string }).id ?? "").trim();
    const exam = await loadExam(examId);
    if (!exam) return reply.status(404).send({ type: "not_found", message: "Exam not found" });

    const userId = String(user.id);
    const idempotencyKey = buildDeterministicJobKey({
      moduleId: "examinations",
      kind: "results-export",
      payload: { examId },
    });
    const jobId = buildBackgroundJobId(tenant, userId, idempotencyKey);
    const existing = await getUserBackgroundJob(userId, jobId);
    if (existing) return reply.status(202).send({ job: existing });

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
        { examId, label: `Exported marks for ${exam.name}` },
      );
      return reply.status(202).send({ job });
    } catch (error) {
      if (error instanceof QueueUnavailableError) {
        return sendServiceUnavailable(reply, error.message);
      }
      throw error;
    }
  });
};
