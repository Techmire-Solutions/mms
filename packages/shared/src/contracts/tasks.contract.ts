import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { bulkStringIdsBodySchema } from "../schemas/api.dto.js";
import {
  taskInsertSchema,
  taskListQuerySchema,
  taskSettingsSchema,
  taskStatusUpdateSchema,
  taskUpdateSchema,
} from "../obligations/tasksModuleManifest.js";

const c = initContract();

const ok = z.unknown();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const idParams = z.object({ id: z.string() });

/**
 * Tasks module routes. Served by plain Fastify plugins in the backend
 * (`routes/tenant/tasksRoutes.ts` + soft-delete/export plugins); declared here so the
 * ts-rest client can reach them. Responses stay `unknown` — the widened client (ADR-010)
 * reads the shared `Task*` types at the call site.
 */
export const tasksContract = c.router({
  list: {
    method: "GET",
    path: "/api/tasks",
    query: taskListQuerySchema,
    responses: { 200: ok, 403: errorResponse, 500: errorResponse },
    summary: "List tasks",
  },
  metrics: {
    method: "GET",
    path: "/api/tasks/metrics",
    responses: { 200: ok, 403: errorResponse },
    summary: "Task counts by status and priority",
  },
  eligibleAssignees: {
    method: "GET",
    path: "/api/tasks/eligible-assignees",
    responses: { 200: ok, 403: errorResponse },
    summary: "Assignees the current user may delegate to",
  },
  getSettings: {
    method: "GET",
    path: "/api/tasks/settings",
    responses: { 200: ok, 403: errorResponse },
    summary: "Tenant task settings",
  },
  updateSettings: {
    method: "PUT",
    path: "/api/tasks/settings",
    body: taskSettingsSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Update tenant task settings",
  },
  get: {
    method: "GET",
    path: "/api/tasks/:id",
    pathParams: idParams,
    responses: { 200: ok, 403: errorResponse, 404: errorResponse },
    summary: "Get a task by id",
  },
  create: {
    method: "POST",
    path: "/api/tasks",
    body: taskInsertSchema,
    responses: { 201: ok, 400: errorResponse, 403: errorResponse },
    summary: "Create a task",
  },
  update: {
    method: "PATCH",
    path: "/api/tasks/:id",
    pathParams: idParams,
    body: taskUpdateSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 404: errorResponse },
    summary: "Update a task",
  },
  updateStatus: {
    method: "PATCH",
    path: "/api/tasks/:id/status",
    pathParams: idParams,
    body: taskStatusUpdateSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 404: errorResponse },
    summary: "Update a task's status",
  },
  remove: {
    method: "DELETE",
    path: "/api/tasks/:id",
    pathParams: idParams,
    body: z.unknown().optional(),
    responses: { 200: ok, 403: errorResponse, 404: errorResponse },
    summary: "Soft-delete a task",
  },
  restore: {
    method: "POST",
    path: "/api/tasks/:id/restore",
    pathParams: idParams,
    body: z.unknown().optional(),
    responses: { 200: ok, 403: errorResponse, 404: errorResponse },
    summary: "Restore a soft-deleted task",
  },
  bulkDelete: {
    method: "POST",
    path: "/api/tasks/bulk-delete",
    body: bulkStringIdsBodySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Soft-delete multiple tasks",
  },
  bulkRestore: {
    method: "POST",
    path: "/api/tasks/bulk-restore",
    body: bulkStringIdsBodySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Restore multiple soft-deleted tasks",
  },
});
