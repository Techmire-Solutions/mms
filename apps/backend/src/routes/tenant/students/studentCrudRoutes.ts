import type { FastifyPluginAsync } from "fastify";
import { withTenant } from "../../../db/tenant-context.js";
import {
  canDeleteCollection,
  canWriteCollection,
  canReadCollection,
} from "../../../services/rbacService.js";
import { isQueryFlagTrue, type User, type Student, studentCrudContract } from "@mms/shared";
import { studentUseCases } from "../../../students/use-cases/studentUseCases.js";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { replyValidationError } from "../../../lib/zodRequest.js";
import {
  auditStudent,
  mapStudentWriteHttpError,
  sanitizeOneStudentForUser,
  sanitizeStudentsForUser,
  withStudentTenantScope,
} from "./studentRouteHelpers.js";

const s = initServer();

/** Main student CRUD — @ts-rest contract router. */
export const studentCrudRoutes: FastifyPluginAsync = async (fastify) => {
  const router = s.router(studentCrudContract, {
    list: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof studentCrudContract)["list"]>): Promise<
      ContractRouteResponse<(typeof studentCrudContract)["list"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "students")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      const skipCount = isQueryFlagTrue(query?.skipCount);
      if (includeDeleted && !canDeleteCollection(user, "students")) {
        return {
          status: 403 as const,
          body: {
            type: "forbidden",
            message: "Viewing deleted students requires delete permissions",
          },
        };
      }
      const result = await withStudentTenantScope(
        String(request.tenant?.id),
        includeDeleted,
        () => studentUseCases.loadStudentsPage({ ...query, includeDeleted, skipCount }),
        { readOnly: true },
      );
      return {
        status: 200 as const,
        body: {
          ...result,
          students: await sanitizeStudentsForUser(result.students, user),
        },
      };
    },

    get: async ({
      params: { id },
      query,
      request,
    }: ContractRouteArgs<(typeof studentCrudContract)["get"]>): Promise<
      ContractRouteResponse<(typeof studentCrudContract)["get"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "students")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
        if (includeDeleted && !canDeleteCollection(user, "students")) {
          return {
            status: 403 as const,
            body: {
              type: "forbidden",
              message: "Viewing deleted students requires delete permissions",
            },
          };
        }
        const item = await withStudentTenantScope(
          String(request.tenant?.id),
          includeDeleted,
          () => studentUseCases.loadStudentById(id, includeDeleted),
          { readOnly: true },
        );
        if (!item || (!includeDeleted && (item as { deletedAt?: unknown }).deletedAt != null)) {
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Student not found" },
          };
        }
        const response = await sanitizeOneStudentForUser(item as Student, user);
        return { status: 200 as const, body: { student: response } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to load student" },
        };
      }
    },

    create: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof studentCrudContract)["create"]>): Promise<
      ContractRouteResponse<(typeof studentCrudContract)["create"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "students")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => studentUseCases.createStudent(body, user),
          { readOnly: false },
        );
        if (result.restored) {
          await auditStudent(
            user,
            "student.restore",
            `Restored student ${result.record.id} via re-registration`,
            String(result.record.id),
          );
        } else {
          await auditStudent(
            user,
            "student.create",
            `Created student ${result.record.id}`,
            String(result.record.id),
          );
        }
        const response = await sanitizeOneStudentForUser(result.record as Student, user);
        return result.restored
          ? { status: 200 as const, body: { student: response } }
          : { status: 201 as const, body: { student: response } };
      } catch (error: unknown) {
        const mapped = mapStudentWriteHttpError(error);
        if (mapped) return { status: mapped.status as 400 | 403 | 409, body: mapped.body };
        request.log.error(error, "Failed to create student");
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to create student" },
        };
      }
    },

    update: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof studentCrudContract)["update"]>): Promise<
      ContractRouteResponse<(typeof studentCrudContract)["update"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "students")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const updated = await withTenant(
          String(request.tenant?.id),
          () =>
            studentUseCases.updateStudentById(
              id,
              {
                ...body,
                id,
              },
              user,
            ),
          { readOnly: false },
        );
        if (!updated) {
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Student not found" },
          };
        }
        await auditStudent(user, "student.update", `Updated student ${id}`, id);
        const response = await sanitizeOneStudentForUser(updated as Student, user);
        return { status: 200 as const, body: { student: response } };
      } catch (error: unknown) {
        const mapped = mapStudentWriteHttpError(error);
        if (mapped) return { status: mapped.status as 400 | 403 | 409, body: mapped.body };
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to update student" },
        };
      }
    },

    delete: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof studentCrudContract)["delete"]>): Promise<
      ContractRouteResponse<(typeof studentCrudContract)["delete"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "students")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const reason = body?.deletionReason;
        const deleted = await withTenant(
          String(request.tenant?.id),
          () => studentUseCases.softDeleteStudentById(id, String(user.id), reason),
          { readOnly: false },
        );
        if (!deleted) {
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Student not found" },
          };
        }
        const reasonNote = reason?.trim() ? ` — ${reason.trim()}` : "";
        await auditStudent(
          user,
          "student.soft_delete",
          `Soft-deleted student ${id}${reasonNote}`,
          id,
        );
        return { status: 200 as const, body: { success: true } };
      } catch (error: unknown) {
        const mapped = mapStudentWriteHttpError(error);
        if (mapped && mapped.status === 409) {
          return { status: 409 as const, body: mapped.body };
        }
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to delete student" },
        };
      }
    },
  } as unknown as RouterImplementation<typeof studentCrudContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: (err, _request, reply) => {
      const zErr = err.body ?? err.query ?? err.pathParams ?? err.headers;
      const message = zErr instanceof Error ? zErr.message : err.message;
      void replyValidationError(reply, message);
    },
  });
};
