import type { FastifyPluginAsync } from "fastify";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { canWriteCollection, canReadCollection } from "../../../services/rbacService.js";
import { STUDENTS_MODULE_MANIFEST, type User, studentOperationsContract } from "@mms/shared";
import { studentUseCases } from "../../../students/use-cases/studentUseCases.js";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { replyValidationError } from "../../../lib/zodRequest.js";
import { auditStudent } from "./studentRouteHelpers.js";
import { getModuleAccessDenial } from "../../../middleware/requireTenantModule.js";

import { handleContractError } from "../../../lib/contractError.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";
const s = initServer();

/** Students operations — bulk status, bulk enroll, next GR, duplicate check, migrate GR. */
export const studentOperationRoutes: FastifyPluginAsync = async (fastify) => {
  const router = s.router(studentOperationsContract, {
    bulkStatus: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof studentOperationsContract)["bulkStatus"]>): Promise<
      ContractRouteResponse<(typeof studentOperationsContract)["bulkStatus"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "students")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        // Per-student subject-scoped audit rows are written by the transition pipeline itself;
        // a collection summary here would duplicate them under the bogus "students" subject.
        const result = await withTenant(
          String(request.tenant?.id),
          () =>
            studentUseCases.bulkUpdateStudentStatus(
              body.ids.map(String),
              body.status,
              request.user as User,
            ),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          "statusCode" in err &&
          (err as { statusCode: number }).statusCode === 400
        ) {
          return { status: 400 as const, body: { type: "validation_error", message: err.message } };
        }
        return handleContractError(request, err, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk update student status" },
        });
      }
    },

    bulkEnroll: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof studentOperationsContract)["bulkEnroll"]>): Promise<
      ContractRouteResponse<(typeof studentOperationsContract)["bulkEnroll"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "students")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      // Enrollment rows belong to the enrollments module: writing them from the
      // students surface still requires `enrollments.write` and an enabled
      // enrollments module for the workspace (module access gates are enforced
      // server-side, not by frontend visibility).
      const enrollmentDenial = await getModuleAccessDenial(request, "enrollment", "write");
      if (enrollmentDenial) {
        return { status: 403 as const, body: enrollmentDenial };
      }
      if (!canWriteCollection(user, "enrollments")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Enrollment write permission required" },
        };
      }
      // Eligibility/deadline overrides are administrative: only roles with the manage
      // capability may bypass a business rule (and the override is audited per enrollment).
      if (
        (body.allowAfterDeadline || body.ignoreEligibility) &&
        !userHasPermission(user, "enrollments.manage")
      ) {
        return {
          status: 403 as const,
          body: {
            type: "forbidden",
            message:
              "Administrative enrollment permission required to override eligibility/deadlines",
          },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () =>
            studentUseCases.bulkEnrollStudents({
              ...body,
              studentIds: body.studentIds.map(String),
            }),
          { readOnly: false },
        );
        await auditStudent(
          user,
          "student.bulk_enroll",
          `Updated session enrollments (${body.mode}) for ${result.succeeded} student(s)`,
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk enroll students" },
        });
      }
    },

    nextGrNumber: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof studentOperationsContract)["nextGrNumber"]>): Promise<
      ContractRouteResponse<(typeof studentOperationsContract)["nextGrNumber"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "students")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const tenantId = request.tenant?.id || getRequestTenant();
      if (!tenantId) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "This endpoint requires a tenant subdomain" },
        };
      }
      try {
        const grNumber = await withTenant(
          tenantId,
          () =>
            studentUseCases.computeNextGrNumberForDate(query.registeredDate, {
              grNumberTemplate: query.template ?? "{seq}-{year}",
              grNumberDigits: query.digits ?? 4,
              grNumberRestartAnnually: query.restartAnnually ?? true,
            }),
          { readOnly: true },
        );
        return { status: 200 as const, body: { grNumber } };
      } catch (error: unknown) {
        request.log.error(error, "Failed to compute next GR number");
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to compute next GR number" },
        };
      }
    },

    duplicateCheck: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof studentOperationsContract)["duplicateCheck"]>): Promise<
      ContractRouteResponse<(typeof studentOperationsContract)["duplicateCheck"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "students")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const tenantId = request.tenant?.id || getRequestTenant();
      if (!tenantId) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "This endpoint requires a tenant subdomain" },
        };
      }
      try {
        const result = await withTenant(
          tenantId,
          () => studentUseCases.checkStudentRegistrationDuplicate(body, tenantId),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch (error: unknown) {
        request.log.error(error, "Failed to check student duplicate");
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to check duplicate" },
        };
      }
    },

    migrateGrNumbers: async ({
      request,
    }: ContractRouteArgs<(typeof studentOperationsContract)["migrateGrNumbers"]>): Promise<
      ContractRouteResponse<(typeof studentOperationsContract)["migrateGrNumbers"]>
    > => {
      const user = request.user as User;
      if (!userHasPermission(user, STUDENTS_MODULE_MANIFEST.permissions.setupWrite)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () =>
            studentUseCases.migrateStudentsMissingGrNumbers(user?.id ? String(user.id) : undefined),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error: unknown) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to migrate GR numbers" },
        });
      }
    },
  } as unknown as RouterImplementation<typeof studentOperationsContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: (err, _request, reply) => {
      const zErr = err.body ?? err.query ?? err.pathParams ?? err.headers;
      const message = zErr instanceof Error ? zErr.message : err.message;
      void replyValidationError(reply, message);
    },
  });
};
