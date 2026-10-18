import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { SESSIONS_MODULE_MANIFEST, sessionSectionsContract, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import {
  addSectionStudentRole,
  assignSectionStaff,
  endSectionStaff,
  endSectionStudentRole,
  listSectionStaff,
  listSectionStudentRoles,
} from "../../../sessions/use-cases/sectionStaffUseCases.js";

type Contract = typeof sessionSectionsContract;
type Request = ContractRouteArgs<Contract["listStaff"]>["request"];
const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;
const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};
const s = initServer();

const tenantOf = (request: Request) => String(request.tenant?.id ?? "");
const fail = (request: Request, error: unknown, message: string) =>
  handleContractError(request, error, { status: 500, body: { type: "server_error", message } });

/** `/api/sessions/sections/:sectionId/{staff,student-roles}` — effective-dated section staff and student roles. */
export const sessionSectionsRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(sessionSectionsContract, {
    listStaff: async ({ params, request }: ContractRouteArgs<Contract["listStaff"]>) => {
      if (!canReadCollection(request.user as User, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: { assignments: await listSectionStaff(tenantOf(request), params.sectionId) },
        };
      } catch (error) {
        return fail(request, error, "Failed to load section staff");
      }
    },
    assignStaff: async ({ params, body, request }: ContractRouteArgs<Contract["assignStaff"]>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        return {
          status: 201 as const,
          body: {
            assignment: await assignSectionStaff(
              tenantOf(request),
              params.sectionId,
              body,
              user.id,
            ),
          },
        };
      } catch (error) {
        return fail(request, error, "Failed to assign section staff");
      }
    },
    endStaff: async ({ params, body, request }: ContractRouteArgs<Contract["endStaff"]>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: {
            assignment: await endSectionStaff(
              tenantOf(request),
              params.sectionId,
              params.assignmentId,
              body,
              user.id,
            ),
          },
        };
      } catch (error) {
        return fail(request, error, "Failed to end staff assignment");
      }
    },
    listStudentRoles: async ({
      params,
      request,
    }: ContractRouteArgs<Contract["listStudentRoles"]>) => {
      if (!canReadCollection(request.user as User, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: { roles: await listSectionStudentRoles(tenantOf(request), params.sectionId) },
        };
      } catch (error) {
        return fail(request, error, "Failed to load student roles");
      }
    },
    addStudentRole: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["addStudentRole"]>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        return {
          status: 201 as const,
          body: {
            role: await addSectionStudentRole(tenantOf(request), params.sectionId, body, user.id),
          },
        };
      } catch (error) {
        return fail(request, error, "Failed to add student role");
      }
    },
    endStudentRole: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["endStudentRole"]>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: {
            role: await endSectionStudentRole(
              tenantOf(request),
              params.sectionId,
              params.roleId,
              body,
              user.id,
            ),
          },
        };
      } catch (error) {
        return fail(request, error, "Failed to end student role");
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
