/**
 * @file tasksRoutes.ts
 * @description Fastify routes for the Tasks module with hierarchical delegation checks.
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  taskInsertSchema,
  taskStatusUpdateSchema,
  tasksBulkStatusBodySchema,
  taskUpdateSchema,
  type User,
} from "@mms/contracts";
import { canPerformTaskAction } from "./services/taskPermissionService.js";
import {
  mutateTask,
  changeTaskStatus,
  changeTasksBulkStatus,
} from "./services/taskMutationService.js";
import { findTaskById } from "./use-cases/tasksUseCases.js";
import { getEligibleTaskAssignees } from "./services/taskEligibleAssigneesService.js";
import { getTenantTaskSettings, updateTenantTaskSettings } from "./services/taskSettingsService.js";
import { mapTaskRouteError } from "./lib/taskRouteErrors.js";
import { registerTasksReadRoutes } from "./routes/tasksReadRoutes.js";
import { registerTasksSoftDeleteRoutes } from "./routes/tasksSoftDeleteRoutes.js";
import { tasksExportRoutes } from "./routes/tasksExportRoutes.js";

export default async function tasksRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await registerTasksReadRoutes(fastify);

  fastify.get("/api/tasks/eligible-assignees", async (request, reply) => {
    const user = request.user as User;
    if (!(await canPerformTaskAction(request, "tasks.read"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    const tenant = String(request.tenant?.id);
    const settings = await getTenantTaskSettings();
    const canAssignAnywhere = await canPerformTaskAction(request, "tasks.assign_anywhere");
    const eligible = await getEligibleTaskAssignees(tenant, user.id, {
      canAssignAnywhere,
      delegationScope: settings.delegationScope,
      allowSelfAssignment: settings.allowSelfAssignment,
    });
    return reply.status(200).send(eligible);
  });

  fastify.get("/api/tasks/settings", async (request, reply) => {
    if (!(await canPerformTaskAction(request, "tasks.read"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    const settings = await getTenantTaskSettings();
    return reply.status(200).send(settings);
  });

  fastify.put(
    "/api/tasks/settings",
    { config: { moduleAction: "setupWrite" } },
    async (request, reply) => {
      if (!(await canPerformTaskAction(request, "settings.global.write"))) {
        return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
      }
      try {
        const updated = await updateTenantTaskSettings(request.body);
        return reply.status(200).send(updated);
      } catch (err) {
        return reply.status(400).send({
          type: "validation_error",
          message: err instanceof Error ? err.message : "Invalid settings payload",
        });
      }
    },
  );

  fastify.get<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    if (!(await canPerformTaskAction(request, "tasks.read"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    const task = await findTaskById(String(request.tenant?.id), request.params.id);
    if (!task) {
      return reply.status(404).send({ type: "not_found", message: "Task not found" });
    }
    return reply.status(200).send(task);
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  fastify.post("/api/tasks", async (request, reply) => {
    const user = request.user as User;
    if (!(await canPerformTaskAction(request, "tasks.write"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    const parsed = taskInsertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        type: "validation_error",
        message: "Invalid payload",
        errors: parsed.error.issues,
      });
    }

    if (parsed.data.assignees.length && !(await canPerformTaskAction(request, "tasks.assign"))) {
      return reply
        .status(403)
        .send({ type: "forbidden", message: "Assignment permission required" });
    }
    try {
      const task = await mutateTask(
        String(request.tenant?.id),
        user.id,
        await canPerformTaskAction(request, "tasks.assign_anywhere"),
        { kind: "create", data: parsed.data },
      );
      return reply.status(201).send(task);
    } catch (error) {
      const mapped = mapTaskRouteError(error);
      if (mapped) return reply.status(mapped.status).send(mapped.body);
      request.log.error({ err: error }, "Failed to create task");
      return reply.status(500).send({ type: "server_error", message: "Failed to create task" });
    }
  });

  fastify.patch<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    const user = request.user as User;
    if (!(await canPerformTaskAction(request, "tasks.write"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    const parsed = taskUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        type: "validation_error",
        message: "Invalid payload",
        errors: parsed.error.issues,
      });
    }

    if (
      parsed.data.assignees !== undefined &&
      !(await canPerformTaskAction(request, "tasks.assign"))
    ) {
      return reply
        .status(403)
        .send({ type: "forbidden", message: "Assignment permission required" });
    }
    try {
      const updated = await mutateTask(
        String(request.tenant?.id),
        user.id,
        await canPerformTaskAction(request, "tasks.assign_anywhere"),
        {
          kind: "update",
          id: request.params.id,
          data: parsed.data,
          expectedUpdatedAt: request.headers["x-expected-updated-at"] as string | undefined,
        },
      );
      if (!updated) return reply.status(404).send({ type: "not_found", message: "Task not found" });
      return reply.status(200).send(updated);
    } catch (error) {
      const mapped = mapTaskRouteError(error);
      if (mapped) return reply.status(mapped.status).send(mapped.body);
      request.log.error({ err: error }, "Failed to update task");
      return reply.status(500).send({ type: "server_error", message: "Failed to update task" });
    }
  });

  fastify.patch<{ Params: { id: string } }>("/api/tasks/:id/status", async (request, reply) => {
    const user = request.user as User;
    if (
      !(await canPerformTaskAction(request, "tasks.write")) &&
      !(await canPerformTaskAction(request, "tasks.complete"))
    ) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    const parsed = taskStatusUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        type: "validation_error",
        message: "Invalid payload",
        errors: parsed.error.issues,
      });
    }
    const tenant = String(request.tenant?.id);
    try {
      const updated = await changeTaskStatus(
        tenant,
        user.id,
        await canPerformTaskAction(request, "tasks.assign_anywhere"),
        request.params.id,
        parsed.data.status,
        parsed.data.forceCompleteSubtasks === true,
        request.headers["x-expected-updated-at"] as string | undefined,
      );
      if (!updated) {
        return reply.status(404).send({ type: "not_found", message: "Task not found" });
      }
      return reply.status(200).send(updated);
    } catch (error) {
      const mapped = mapTaskRouteError(error);
      if (mapped) return reply.status(mapped.status).send(mapped.body);
      request.log.error({ err: error }, "Failed to update task status");
      return reply
        .status(500)
        .send({ type: "server_error", message: "Failed to update task status" });
    }
  });

  fastify.post("/api/tasks/bulk-status", async (request, reply) => {
    const user = request.user as User;
    if (
      !(await canPerformTaskAction(request, "tasks.write")) &&
      !(await canPerformTaskAction(request, "tasks.complete"))
    ) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    const parsed = tasksBulkStatusBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ type: "validation_error", message: "Invalid payload" });
    }
    const tenant = String(request.tenant?.id);
    try {
      const result = await changeTasksBulkStatus(
        tenant,
        user.id,
        await canPerformTaskAction(request, "tasks.assign_anywhere"),
        parsed.data.ids,
        parsed.data.status,
      );
      return reply.status(200).send({
        success: true,
        updatedIds: result.updatedIds,
        skipped: result.skipped,
      });
    } catch (error) {
      const mapped = mapTaskRouteError(error);
      if (mapped) return reply.status(mapped.status).send(mapped.body);
      request.log.error({ err: error }, "Failed to bulk update task status");
      return reply
        .status(500)
        .send({ type: "server_error", message: "Failed to bulk update task status" });
    }
  });

  await registerTasksSoftDeleteRoutes(fastify);
  await fastify.register(tasksExportRoutes, { prefix: "/api/tasks" });
}
