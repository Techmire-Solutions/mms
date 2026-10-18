import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import {
  academicCalendarContract,
  ATTENDANCE_MODULE_MANIFEST,
  isQueryFlagTrue,
  roleHasPermission,
  type User,
} from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { HttpDomainError } from "../../../lib/httpErrors.js";
import { canDeleteCollection, canReadCollection } from "../../../services/rbacService.js";
import { academicCalendarUseCases } from "../../../attendance/use-cases/academicCalendarUseCases.js";

type Contract = typeof academicCalendarContract;
const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;
const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};
const s = initServer();

type AnyRequest = ContractRouteArgs<Contract["list"]>["request"];

function tenantOf(request: AnyRequest): string {
  return String(request.tenant?.id ?? "");
}

function canWriteSetup(user: User): boolean {
  return roleHasPermission(user.role, ATTENDANCE_MODULE_MANIFEST.permissions.setupWrite);
}

function domainError(request: AnyRequest, error: unknown, message: string) {
  if (error instanceof HttpDomainError) {
    return { status: error.statusCode, body: { type: error.type, message: error.message } };
  }
  return handleContractError(request, error, {
    status: 500,
    body: { type: "server_error", message },
  });
}

/** `/api/attendance/calendar` — holidays, make-up days, exam periods, events (Attendance → Setup). */
export const academicCalendarRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(academicCalendarContract, {
    list: async ({ query, request }: ContractRouteArgs<Contract["list"]>) => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION)) return forbidden;
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, COLLECTION)) return forbidden;
      try {
        const items = await academicCalendarUseCases.list(tenantOf(request), {
          from: query?.from,
          to: query?.to,
          includeDeleted,
        });
        return { status: 200 as const, body: { items } };
      } catch (error) {
        return domainError(request, error, "Failed to load the academic calendar");
      }
    },
    save: async ({ params, body, request }: ContractRouteArgs<Contract["save"]>) => {
      const user = request.user as User;
      if (!canWriteSetup(user)) return forbidden;
      try {
        const item = await academicCalendarUseCases.save(
          tenantOf(request),
          params.id,
          body,
          user.id,
        );
        return { status: 200 as const, body: { item } };
      } catch (error) {
        return domainError(request, error, "Failed to save the calendar event");
      }
    },
    remove: async ({ params, request }: ContractRouteArgs<Contract["remove"]>) => {
      const user = request.user as User;
      if (!canWriteSetup(user)) return forbidden;
      try {
        const removed = await academicCalendarUseCases.remove(
          tenantOf(request),
          params.id,
          user.id,
        );
        if (!removed)
          return { status: 404 as const, body: { type: "not_found", message: "Event not found" } };
        return { status: 200 as const, body: { success: true as const } };
      } catch (error) {
        return domainError(request, error, "Failed to delete the calendar event");
      }
    },
    restore: async ({ params, request }: ContractRouteArgs<Contract["restore"]>) => {
      const user = request.user as User;
      if (!canWriteSetup(user)) return forbidden;
      try {
        const item = await academicCalendarUseCases.restore(tenantOf(request), params.id, user.id);
        if (!item)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Event not found in trash" },
          };
        return { status: 200 as const, body: { item } };
      } catch (error) {
        return domainError(request, error, "Failed to restore the calendar event");
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
