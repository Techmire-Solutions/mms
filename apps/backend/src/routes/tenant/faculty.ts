import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import {
  facultySetupConfigRoutes,
  facultyLookupRoutes,
  facultyExportRoutes,
  facultySoftDeleteRoutes,
  facultyAggregateRoutes,
  facultyCrudRoutes,
} from "./faculty/index.js";
import { facultyCatalogIoRoutes } from "./faculty/facultyCatalogIoRoutes.js";
import { facultyImportRoutes } from "./faculty/facultyImportRoutes.js";
import { handleGetFaculty, handleListFaculty } from "./faculty/facultyCrudRoutes.js";
import { facultyListQuerySchema } from "@mms/shared";
import { replyValidationError } from "../../lib/zodRequest.js";

/**
 * Server-first faculty resource routes (TanStack Query on FE).
 * Registers canonical `/api/faculty`, `/api/tenant/faculty`, and `/api/v1/tenant/faculty`.
 */
export default async function facultyRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "faculty");

  // Canonical /api/faculty, /api/tenant/faculty & /api/v1/tenant/faculty
  await fastify.register(facultySetupConfigRoutes, { prefix: "/api/faculty" });
  await fastify.register(facultySetupConfigRoutes, { prefix: "/api/tenant/faculty" });
  await fastify.register(facultySetupConfigRoutes, { prefix: "/api/v1/tenant/faculty" });
  await fastify.register(facultyLookupRoutes, { prefix: "/api/faculty" });
  await fastify.register(facultyLookupRoutes, { prefix: "/api/tenant/faculty" });
  await fastify.register(facultyLookupRoutes, { prefix: "/api/v1/tenant/faculty" });
  await fastify.register(facultyExportRoutes, { prefix: "/api/faculty" });
  await fastify.register(facultyExportRoutes, { prefix: "/api/tenant/faculty" });
  await fastify.register(facultyExportRoutes, { prefix: "/api/v1/tenant/faculty" });
  await fastify.register(facultyImportRoutes, { prefix: "/api/faculty" });
  await fastify.register(facultyImportRoutes, { prefix: "/api/tenant/faculty" });
  await fastify.register(facultyImportRoutes, { prefix: "/api/v1/tenant/faculty" });
  await fastify.register(facultyCatalogIoRoutes, { prefix: "/api/faculty" });
  await fastify.register(facultyCatalogIoRoutes, { prefix: "/api/tenant/faculty" });
  await fastify.register(facultyCatalogIoRoutes, { prefix: "/api/v1/tenant/faculty" });
  await fastify.register(facultySoftDeleteRoutes, { prefix: "/api/faculty" });
  await fastify.register(facultySoftDeleteRoutes, { prefix: "/api/tenant/faculty" });
  await fastify.register(facultySoftDeleteRoutes, { prefix: "/api/v1/tenant/faculty" });
  await fastify.register(facultyAggregateRoutes, { prefix: "/api/faculty" });
  await fastify.register(facultyAggregateRoutes, { prefix: "/api/tenant/faculty" });
  await fastify.register(facultyAggregateRoutes, { prefix: "/api/v1/tenant/faculty" });

  // Legacy /api/v1/tenant/faculty read aliases. Both delegate to the canonical
  // contract handlers so permissions, soft-delete gating, and sanitization stay SSOT.
  fastify.get("/api/v1/tenant/faculty", async (request, reply) => {
    // The contract router validates this query on `/api/faculty`; the alias must
    // not hand raw page/limit/sort/filter strings to the SQL page builder.
    const parsed = facultyListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return replyValidationError(reply, parsed.error.issues[0]?.message ?? "Invalid list query");
    }
    const result = await handleListFaculty({
      query: parsed.data as Record<string, unknown>,
      request,
    });
    return reply.status(result.status).send(result.body);
  });

  fastify.get<{ Params: { id: string } }>("/api/v1/tenant/faculty/:id", async (request, reply) => {
    const result = await handleGetFaculty({
      params: { id: request.params.id },
      query: request.query as Record<string, unknown>,
      request,
    });
    return reply.status(result.status).send(result.body);
  });

  await fastify.register(facultyCrudRoutes);
}
