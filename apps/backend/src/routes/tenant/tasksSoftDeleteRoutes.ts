/**
 * @file tasksSoftDeleteRoutes.ts
 * @description Soft-delete, restore, and bulk trash routes for Tasks.
 */

import type { FastifyInstance } from "fastify";
import { bulkStringIdsBodySchema, type User } from "@mms/shared";
import { canPerformTaskAction } from "../../services/taskPermissionService.js";
import {
  bulkDeleteTasks,
  bulkRestoreTasks,
  deleteTask,
  restoreTask,
} from "../../tasks/use-cases/tasksUseCases.js";
import { mapTaskRouteError } from "../../lib/taskRouteErrors.js";

export async function registerTasksSoftDeleteRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.delete<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    const user = request.user as User;
    if (!(await canPerformTaskAction(request, "tasks.delete"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    try {
      const success = await deleteTask(String(request.tenant?.id), request.params.id, user.id);
      return reply.status(200).send({ success });
    } catch (error) {
      const mapped = mapTaskRouteError(error);
      if (mapped) return reply.status(mapped.status).send(mapped.body);
      request.log.error({ err: error }, "Failed to archive task");
      return reply.status(500).send({ type: "server_error", message: "Failed to archive task" });
    }
  });

  fastify.post<{ Params: { id: string } }>("/api/tasks/:id/restore", async (request, reply) => {
    const user = request.user as User;
    if (!(await canPerformTaskAction(request, "tasks.delete"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    try {
      const restored = await restoreTask(String(request.tenant?.id), request.params.id, user.id);
      if (!restored) {
        return reply.status(404).send({ type: "not_found", message: "Task not found in trash" });
      }
      return reply.status(200).send({ success: true, task: restored });
    } catch (error) {
      const mapped = mapTaskRouteError(error);
      if (mapped) return reply.status(mapped.status).send(mapped.body);
      request.log.error({ err: error }, "Failed to restore task");
      return reply.status(500).send({ type: "server_error", message: "Failed to restore task" });
    }
  });

  fastify.post("/api/tasks/bulk-restore", async (request, reply) => {
    const user = request.user as User;
    if (!(await canPerformTaskAction(request, "tasks.delete"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    const parsed = bulkStringIdsBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ type: "validation_error", message: "Invalid payload" });
    }
    try {
      const result = await bulkRestoreTasks(String(request.tenant?.id), parsed.data.ids, user.id);
      return reply.status(200).send(result);
    } catch (error) {
      const mapped = mapTaskRouteError(error);
      if (mapped) return reply.status(mapped.status).send(mapped.body);
      request.log.error({ err: error }, "Failed to bulk restore tasks");
      return reply
        .status(500)
        .send({ type: "server_error", message: "Failed to bulk restore tasks" });
    }
  });

  fastify.post("/api/tasks/bulk-delete", async (request, reply) => {
    const user = request.user as User;
    if (!(await canPerformTaskAction(request, "tasks.delete"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    const parsed = bulkStringIdsBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ type: "validation_error", message: "Invalid payload" });
    }
    try {
      const result = await bulkDeleteTasks(String(request.tenant?.id), parsed.data.ids, user.id);
      return reply.status(200).send(result);
    } catch (error) {
      const mapped = mapTaskRouteError(error);
      if (mapped) return reply.status(mapped.status).send(mapped.body);
      request.log.error({ err: error }, "Failed to bulk archive tasks");
      return reply
        .status(500)
        .send({ type: "server_error", message: "Failed to bulk archive tasks" });
    }
  });
}
