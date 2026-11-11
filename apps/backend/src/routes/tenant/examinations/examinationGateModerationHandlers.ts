import { type User, type examinationContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canDeleteCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { NotFoundError } from "../../../lib/httpErrors.js";
import { invalidateMultiTierCache } from "../../../lib/cache/index.js";
import { broadcastTenantUpdate } from "../../../lib/livePush.js";
import {
  publishExamResults,
  unpublishExamResults,
} from "../../../examinations/use-cases/examLifecycleUseCases.js";
import { examinationsUseCases } from "../../../examinations/use-cases/examinationsUseCases.js";
import { mapGateError } from "./examinationGateErrors.js";

/**
 * Moderation + publication handlers.
 *
 * Split from `examinationGateHandlers.ts` for the 300-line band. Both are controller actions:
 * moderation and publication/unlock require `examinations.delete`, not an ordinary marking edit.
 */
export function moderationGateHandlers() {
  return {
    moderateExamResult: async ({
      params: { id, studentId },
      body,
      request,
    }: ContractRouteArgs<(typeof examinationContract)["moderateExamResult"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["moderateExamResult"]>
    > => {
      const user = request.user as User;
      // Moderation is a controller action, not an ordinary marking edit: grace marks change what a
      // student passed, so it shares the publish/unlock authority (`examinations.delete`).
      if (!canDeleteCollection(user, "exams")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Moderator rights required" },
        };
      }
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Missing tenant context" },
        };
      }
      try {
        // The raw mark is never rewritten: moderation stores the adjustment beside it, with the
        // reason and actor, and the write is refused once results are published.
        const result = await withTenant(
          tenant,
          () =>
            examinationsUseCases.moderateExamResult({
              examId: id,
              studentId,
              graceMarks: body.graceMarks,
              reason: body.reason,
              actorId: String(user.id),
              version: body.version,
            }),
          { readOnly: false },
        );
        await invalidateMultiTierCache({ tenantId: tenant, domain: "examinations" });
        // Other clients' marks/analytics views must refresh after a grace adjustment.
        broadcastTenantUpdate(tenant, "collection", "exam_results");
        return { status: 200 as const, body: result };
      } catch (error) {
        return mapGateError(request, error, "Failed to apply the moderation");
      }
    },

    setExamResultsFinalized: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof examinationContract)["setExamResultsFinalized"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["setExamResultsFinalized"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "exams")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Missing tenant context" },
        };
      }
      try {
        // Publication is a lifecycle transition, so the route only decides which direction the
        // caller asked for; the legality, the required unlock reason and the resulting status are
        // the use case's job.
        const result = await withTenant(
          tenant,
          () =>
            body.finalized
              ? publishExamResults(tenant, {
                  examId: id,
                  actorId: String(user.id),
                  reason: body.reason ?? null,
                })
              : unpublishExamResults(tenant, {
                  examId: id,
                  actorId: String(user.id),
                  reason: body.reason ?? null,
                }),
          { readOnly: false },
        );
        if (!result) throw new NotFoundError("Exam not found");
        // Completion reads the finalisation stamp; its cached rows must not survive the change.
        await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
        // Publication flips the exam lock and the marks visibility for every client.
        broadcastTenantUpdate(tenant, "collection", "exams");
        broadcastTenantUpdate(tenant, "collection", "exam_results");
        return {
          status: 200 as const,
          body: {
            examId: result.examId,
            resultsFinalizedAt: result.resultsFinalizedAt
              ? result.resultsFinalizedAt.toISOString()
              : null,
            status: result.status,
          },
        };
      } catch (error) {
        return mapGateError(request, error, "Failed to update the results finalisation");
      }
    },
  };
}
