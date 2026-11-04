import type { FastifyInstance } from "fastify";
import { taskListQuerySchema } from "@mms/shared";
import { canPerformTaskAction } from "../../services/taskPermissionService.js";
import { getTaskMetrics, listTasks } from "../../tasks/use-cases/tasksUseCases.js";
import { mapTaskRouteError } from "../../lib/taskRouteErrors.js";

/** Tasks Work-list reads (list + metrics), registered inside the tasks module scope. */
export async function registerTasksReadRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/api/tasks", async (request, reply) => {
    if (!(await canPerformTaskAction(request, "tasks.read"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    const query = taskListQuerySchema.parse(request.query);
    // Trash reads require delete permission, matching Contacts/Students/Faculty.
    // Frontend visibility is not a boundary: the archive is only readable by
    // roles allowed to restore or purge it.
    if (query.includeDeleted && !(await canPerformTaskAction(request, "tasks.delete"))) {
      return reply
        .status(403)
        .send({ type: "forbidden", message: "Viewing deleted tasks requires delete permissions" });
    }
    const result = await listTasks(String(request.tenant?.id), query);
    return reply.status(200).send(result);
  });

  fastify.get("/api/tasks/metrics", async (request, reply) => {
    if (!(await canPerformTaskAction(request, "tasks.read"))) {
      return reply.status(403).send({ type: "forbidden", message: "Forbidden" });
    }
    try {
      const metrics = await getTaskMetrics(String(request.tenant?.id));
      return reply.status(200).send(metrics);
    } catch (error) {
      const mapped = mapTaskRouteError(error);
      if (mapped) return reply.status(mapped.status).send(mapped.body);
      request.log.error({ err: error }, "Failed to load task metrics");
      return reply
        .status(500)
        .send({ type: "server_error", message: "Failed to load task metrics" });
    }
  });
}
