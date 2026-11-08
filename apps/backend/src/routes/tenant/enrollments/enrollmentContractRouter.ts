import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import {
  enrollmentContract,
  isQueryFlagTrue,
  ENROLLMENTS_MODULE_MANIFEST,
  type User,
} from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  canReadCollection,
  canWriteCollection,
  canDeleteCollection,
} from "../../../services/rbacService.js";
import { enrollmentsUseCases } from "../../../enrollments/use-cases/enrollmentsUseCases.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";

const ENROLLMENTS_COLLECTION = ENROLLMENTS_MODULE_MANIFEST.collectionKey;
/** Fee fields are financial adjustments: they require the administrative capability. */
const ENROLLMENT_FEE_FIELDS = [
  "baseFee",
  "discountType",
  "discountLabel",
  "discountPct",
  "discountAmt",
  "finalFee",
] as const;
const s = initServer();
/**
 * Verified tenant id from `authenticateTenant`. Missing here means the auth pipeline did not
 * run: fail closed with an empty scope (the tenant guard rejects it) instead of binding the
 * literal string "undefined" as a workspace.
 */
const tenantOf = (request: { tenant?: { id?: unknown } }): string =>
  String(request.tenant?.id ?? "").trim();

export const enrollmentContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(enrollmentContract, {
    list: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof enrollmentContract)["list"]>): Promise<
      ContractRouteResponse<(typeof enrollmentContract)["list"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, ENROLLMENTS_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, ENROLLMENTS_COLLECTION)) {
        return {
          status: 403 as const,
          body: {
            type: "forbidden",
            message: "Viewing deleted enrollments requires delete permissions",
          },
        };
      }
      try {
        const result = await withTenant(
          tenantOf(request),
          () =>
            enrollmentsUseCases.loadEnrollmentsPage({ ...query, includeDeleted } as Parameters<
              typeof enrollmentsUseCases.loadEnrollmentsPage
            >[0]),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to list enrollments" },
        });
      }
    },
    get: async ({
      params: { id },
      query,
      request,
    }: ContractRouteArgs<(typeof enrollmentContract)["get"]>): Promise<
      ContractRouteResponse<(typeof enrollmentContract)["get"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, ENROLLMENTS_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, ENROLLMENTS_COLLECTION)) {
        return {
          status: 403 as const,
          body: {
            type: "forbidden",
            message: "Viewing deleted enrollments requires delete permissions",
          },
        };
      }
      try {
        const item = await withTenant(
          tenantOf(request),
          () => enrollmentsUseCases.loadEnrollmentById(id, includeDeleted),
          { readOnly: true },
        );
        if (!item)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Enrollment not found" },
          };
        return { status: 200 as const, body: item };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to load enrollment" },
        });
      }
    },
    create: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof enrollmentContract)["create"]>): Promise<
      ContractRouteResponse<(typeof enrollmentContract)["create"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, ENROLLMENTS_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const item = await withTenant(
          tenantOf(request),
          () => enrollmentsUseCases.createEnrollment(body),
          { readOnly: false },
        );
        return { status: 201 as const, body: item };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to create enrollment" },
        });
      }
    },
    update: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof enrollmentContract)["update"]>): Promise<
      ContractRouteResponse<(typeof enrollmentContract)["update"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, ENROLLMENTS_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const touchesFees = ENROLLMENT_FEE_FIELDS.some(
        (field) => (body as Record<string, unknown>)[field] !== undefined,
      );
      if (touchesFees && !userHasPermission(user, "enrollments.manage")) {
        return {
          status: 403 as const,
          body: {
            type: "forbidden",
            message: "Administrative enrollment permission required to adjust fees",
          },
        };
      }
      try {
        const updated = await withTenant(
          tenantOf(request),
          () => enrollmentsUseCases.updateEnrollmentById(id, body),
          { readOnly: false },
        );
        if (!updated)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Enrollment not found" },
          };
        return { status: 200 as const, body: updated };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to update enrollment" },
        });
      }
    },
    delete: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof enrollmentContract)["delete"]>): Promise<
      ContractRouteResponse<(typeof enrollmentContract)["delete"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, ENROLLMENTS_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const deleted = await withTenant(
          tenantOf(request),
          () => enrollmentsUseCases.deleteEnrollmentById(id, String(user.id), body?.deletionReason),
          { readOnly: false },
        );
        if (!deleted)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Enrollment not found" },
          };
        return { status: 200 as const, body: { success: true } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to delete enrollment" },
        });
      }
    },
    bulkDelete: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof enrollmentContract)["bulkDelete"]>): Promise<
      ContractRouteResponse<(typeof enrollmentContract)["bulkDelete"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, ENROLLMENTS_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          tenantOf(request),
          () =>
            enrollmentsUseCases.bulkSoftDeleteEnrollments(
              body.ids.map(String),
              String(user.id),
              body.deletionReason,
            ),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk delete enrollments" },
        });
      }
    },
    bulkRestore: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof enrollmentContract)["bulkRestore"]>): Promise<
      ContractRouteResponse<(typeof enrollmentContract)["bulkRestore"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, ENROLLMENTS_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          tenantOf(request),
          () => enrollmentsUseCases.bulkRestoreEnrollments(body.ids.map(String), String(user.id)),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk restore enrollments" },
        });
      }
    },
  } as unknown as RouterImplementation<typeof enrollmentContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
    // The declared response schemas are the wire contract: validate them at runtime so a
    // handler that returns a drifted shape fails fast instead of silently shipping it.
    responseValidation: true,
  });
};
