import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { withTenant } from "../../../db/tenant-context.js";
import { canDeleteCollection, canReadCollection } from "../../../services/rbacService.js";
import { isQueryFlagTrue, type Faculty, type User, facultyContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { replyValidationError } from "../../../lib/zodRequest.js";
import { facultyUseCases } from "../../../faculty/use-cases/facultyUseCases.js";
import {
  sanitizeOneFacultyForUser,
  sanitizeFacultyForUser,
  handleDuplicateCheck,
  handleNextEmployeeId,
  handleMigrateEmployeeIds,
} from "./facultyRouteHelpers.js";
import {
  handleListDesignations,
  handleRestoreDesignation,
  handleListDesignationHistory,
  handleSaveDesignation,
  handleDeleteDesignation,
} from "./facultyDesignationRouteHandlers.js";
import {
  handleListDepartments,
  handleRestoreDepartment,
  handleSaveDepartment,
  handleDeleteDepartment,
} from "./facultyDepartmentRouteHandlers.js";
import {
  handleListAssignments,
  handleSaveAssignment,
  handleCloseAssignment,
  handleDeleteAssignment,
  handleGetSubordinates,
  handleGetManagers,
} from "./facultyAssignmentRouteHandlers.js";
import {
  handleCreateFaculty,
  handleUpdateFaculty,
  handleDeleteFaculty,
} from "./facultyMutationRouteHandlers.js";
import { handleBulkStatus, handleBulkSpecialization } from "./facultyBulkRouteHandlers.js";
import { authenticateTenant } from "../../../middleware/authenticate.js";

const s = initServer();

/**
 * Canonical faculty list read. Shared by the ts-rest contract router and the
 * legacy `/api/v1/tenant/faculty` alias so permissions, soft-delete gating, and
 * field sanitization exist in exactly one place.
 */
export async function handleListFaculty({
  query,
  request,
}: {
  query: Record<string, unknown>;
  request: FastifyRequest;
}): Promise<ContractRouteResponse<(typeof facultyContract)["list"]>> {
  const user = request.user as User;
  if (!canReadCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
  const skipCount = isQueryFlagTrue(query?.skipCount);
  if (includeDeleted && !canDeleteCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: {
        type: "forbidden",
        message: "Viewing deleted faculty requires delete permissions",
      },
    };
  }
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () => facultyUseCases.loadFacultyPage({ ...query, includeDeleted, skipCount }),
      { readOnly: true },
    );
    const sourceList = (result.faculty ?? []) as Faculty[];
    const sanitized = await sanitizeFacultyForUser(sourceList, user);
    return {
      status: 200 as const,
      body: {
        ...result,
        faculty: sanitized,
      },
    };
  } catch (error: unknown) {
    request.log.error({ err: error }, "Failed to list faculty");
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to list faculty" },
    };
  }
}

/** Canonical single faculty read (contract router + `/api/v1/tenant/faculty/:id`). */
export async function handleGetFaculty({
  params: { id },
  query,
  request,
}: {
  params: { id: string };
  query?: Record<string, unknown>;
  request: FastifyRequest;
}): Promise<ContractRouteResponse<(typeof facultyContract)["get"]>> {
  const user = request.user as User;
  if (!canReadCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
  if (includeDeleted && !canDeleteCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: {
        type: "forbidden",
        message: "Viewing deleted faculty requires delete permissions",
      },
    };
  }
  try {
    const item = await withTenant(
      String(request.tenant?.id),
      () => facultyUseCases.loadFacultyById(id, includeDeleted),
      { readOnly: true },
    );
    if (!item || (!includeDeleted && (item as { deletedAt?: unknown }).deletedAt != null)) {
      return {
        status: 404 as const,
        body: { type: "not_found", message: "Faculty member not found" },
      };
    }
    const sanitized = await sanitizeOneFacultyForUser(item as Faculty, user);
    return {
      status: 200 as const,
      body: {
        faculty: sanitized,
        facultyMember: sanitized,
      },
    };
  } catch (error: unknown) {
    request.log.error({ err: error }, "Failed to load faculty member");
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to load faculty member" },
    };
  }
}

/** Main faculty CRUD — @ts-rest contract router. */
export const facultyCrudRoutes: FastifyPluginAsync = async (fastify) => {
  // M-1 fix: explicit guard in case @ts-rest s.plugin() creates an encapsulated scope
  // that would bypass the parent preHandler hooks.
  fastify.addHook("preHandler", authenticateTenant);

  const router = s.router(facultyContract, {
    list: (args: ContractRouteArgs<(typeof facultyContract)["list"]>) =>
      handleListFaculty({ query: args.query as Record<string, unknown>, request: args.request }),

    get: (args: ContractRouteArgs<(typeof facultyContract)["get"]>) =>
      handleGetFaculty({
        params: { id: String(args.params.id) },
        query: args.query as Record<string, unknown>,
        request: args.request,
      }),

    create: handleCreateFaculty,
    update: handleUpdateFaculty,
    delete: handleDeleteFaculty,

    hierarchyTree: async ({
      request,
    }: ContractRouteArgs<(typeof facultyContract)["hierarchyTree"]>): Promise<
      ContractRouteResponse<(typeof facultyContract)["hierarchyTree"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "faculty")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => facultyUseCases.loadFacultyHierarchyTree(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch (error: unknown) {
        request.log.error({ err: error }, "Failed to load faculty hierarchy tree");
        if ((error as { statusCode?: number }).statusCode === 400) {
          return {
            status: 400 as const,
            body: {
              type: "validation_error",
              message: error instanceof Error ? error.message : "Invalid request",
            },
          };
        }
        return {
          status: 500 as const,
          body: { type: "server_error", message: "Failed to load faculty hierarchy tree" },
        };
      }
    },

    bulkStatus: handleBulkStatus,
    bulkSpecialization: handleBulkSpecialization,

    duplicateCheck: handleDuplicateCheck,
    nextEmployeeId: handleNextEmployeeId,
    migrateEmployeeIds: handleMigrateEmployeeIds,
    listDesignations: handleListDesignations,
    restoreDesignation: handleRestoreDesignation,
    saveDesignation: handleSaveDesignation,
    deleteDesignation: handleDeleteDesignation,
    listDesignationHistory: handleListDesignationHistory,
    listDepartments: handleListDepartments,
    restoreDepartment: handleRestoreDepartment,
    saveDepartment: handleSaveDepartment,
    deleteDepartment: handleDeleteDepartment,
    listAssignments: handleListAssignments,
    saveAssignment: handleSaveAssignment,
    closeAssignment: handleCloseAssignment,
    deleteAssignment: handleDeleteAssignment,
    getAssignmentSubordinates: handleGetSubordinates,
    getAssignmentManagerChain: handleGetManagers,
    // Deliberate, documented exception to the `as unknown as T` ban (mms-agent-universal):
    // ts-rest's own `RouterImplementation` degrades this contract to any/never past the TS
    // union-depth limit, so responses are typed by `ContractRouteResponse` instead — see
    // `lib/contractRouterTypes.ts` for the rationale. 36 routers share this workaround.
  } as unknown as RouterImplementation<typeof facultyContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: (err, _request, reply) => {
      const zErr = err.body ?? err.query ?? err.pathParams ?? err.headers;
      const message = zErr instanceof Error ? zErr.message : err.message;
      void replyValidationError(reply, message);
    },
  });
};
