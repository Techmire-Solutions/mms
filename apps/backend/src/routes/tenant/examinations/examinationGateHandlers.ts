import { type User, type examinationContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { NotFoundError } from "../../../lib/httpErrors.js";
import { invalidateMultiTierCache } from "../../../lib/cache/index.js";
import {
  configureExamAttendanceGate,
  getExamEligibilityView,
  grantExamEligibilityOverride,
  revokeExamEligibilityOverride,
} from "../../../examinations/use-cases/examEligibilityGate.js";
import { examinationsUseCases } from "../../../examinations/use-cases/examinationsUseCases.js";
import { moderationGateHandlers } from "./examinationGateModerationHandlers.js";
import { mapGateError } from "./examinationGateErrors.js";

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
        // An unknown (or another tenant's) exam id must look exactly like a missing one: the
        // eligibility read returns an empty view, which would otherwise confirm the id exists.
        const exam = await withTenant(tenant, () => examinationsUseCases.loadExamById(id, true), {
          readOnly: true,
        });
        if (!exam) throw new NotFoundError("Exam not found");
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

    revokeExamEligibilityOverride: async ({
      params: { id, studentId },
      body,
      request,
    }: ContractRouteArgs<(typeof examinationContract)["revokeExamEligibilityOverride"]>): Promise<
      ContractRouteResponse<(typeof examinationContract)["revokeExamEligibilityOverride"]>
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
            revokeExamEligibilityOverride(tenant, {
              examId: id,
              studentId,
              reason: body.reason,
              actorId: String(user.id),
            }),
          { readOnly: false },
        );
        return { status: 200 as const, body: result };
      } catch (error) {
        return mapGateError(request, error, "Failed to revoke the eligibility override");
      }
    },

    ...moderationGateHandlers(),
  };
}
