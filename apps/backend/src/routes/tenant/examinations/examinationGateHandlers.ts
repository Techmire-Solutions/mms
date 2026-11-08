import type { FastifyRequest } from "fastify";
import { type User, type examinationContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { HttpDomainError, NotFoundError } from "../../../lib/httpErrors.js";
import { invalidateMultiTierCache } from "../../../lib/cache/index.js";
import {
  configureExamAttendanceGate,
  getExamEligibilityView,
  grantExamEligibilityOverride,
  updateExamResultsFinalized,
} from "../../../examinations/use-cases/examEligibilityGate.js";

/**
 * Exam attendance-gate handlers (0222): per-student eligibility, the audited override, the exam's
 * threshold, and the results-finalisation stamp completion depends on.
 */

/** Attendance gate routes — eligibility, audited overrides, and results finalisation. */
export function gateHandlers() {
  return {
    getExamEligibility: async ({
      params: { id },
      request,
    }: ContractRouteArgs<(typeof examinationContract)["getExamEligibility"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["getExamEligibility"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "exams")) {
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
        const view = await withTenant(tenant, () => getExamEligibilityView(tenant, id), {
          readOnly: true,
        });
        return {
          status: 200 as const,
          body: { examId: view.examId, requiredPct: view.requiredPct, students: view.rows },
        };
      } catch (error) {
        return mapGateError(request, error, "Failed to load exam eligibility");
      }
    },

    setExamAttendanceGate: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof examinationContract)["setExamAttendanceGate"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["setExamAttendanceGate"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "exams")) {
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
        await withTenant(
          tenant,
          () =>
            configureExamAttendanceGate(tenant, {
              examId: id,
              minAttendancePct: body.minAttendancePct,
              actorId: String(user.id),
            }),
          { readOnly: false },
        );
        await invalidateMultiTierCache({ tenantId: tenant, domain: "examinations" });
        return {
          status: 200 as const,
          body: { examId: id, minAttendancePct: body.minAttendancePct },
        };
      } catch (error) {
        return mapGateError(request, error, "Failed to set the attendance gate");
      }
    },

    grantExamEligibilityOverride: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof examinationContract)["grantExamEligibilityOverride"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["grantExamEligibilityOverride"]>
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
        await withTenant(
          tenant,
          () =>
            grantExamEligibilityOverride(tenant, {
              examId: id,
              studentId: body.studentId,
              reason: body.reason,
              grantedBy: String(user.id),
            }),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true as const } };
      } catch (error) {
        return mapGateError(request, error, "Failed to grant the eligibility override");
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
        const result = await withTenant(
          tenant,
          () =>
            updateExamResultsFinalized(tenant, {
              examId: id,
              finalized: body.finalized,
              actorId: String(user.id),
            }),
          { readOnly: false },
        );
        if (!result) throw new NotFoundError("Exam not found");
        // Completion reads the finalisation stamp; its cached rows must not survive the change.
        await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
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

function mapGateError(
  request: FastifyRequest,
  error: unknown,
  fallback: string,
): { status: number; body: { type: string; message: string } } {
  if (error instanceof HttpDomainError) {
    return { status: error.statusCode, body: { type: error.type, message: error.message } };
  }
  if (error instanceof NotFoundError) {
    return { status: 404, body: { type: "not_found", message: error.message } };
  }
  request.log.error({ err: error, url: request.url }, fallback);
  return { status: 500, body: { type: "database_error", message: fallback } };
}
