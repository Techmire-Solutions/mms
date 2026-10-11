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
  sanitizeFacultyForUser,
  sanitizeOneFacultyForUser,
} from "./faculty/index.js";
import { facultyCatalogIoRoutes } from "./faculty/facultyCatalogIoRoutes.js";
import { facultyImportRoutes } from "./faculty/facultyImportRoutes.js";
import { facultyUseCases } from "../../faculty/use-cases/facultyUseCases.js";
import { withTenant } from "../../db/tenant-context.js";
import { canReadCollection, canDeleteCollection } from "../../services/rbacService.js";
import { isQueryFlagTrue, type Faculty, type User } from "@mms/shared";

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

  // Explicit /api/v1/tenant/faculty endpoints
  fastify.get("/api/v1/tenant/faculty", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, "faculty")) {
      return reply.status(403).send({ type: "forbidden", message: "Insufficient permissions" });
    }
    const query = request.query as Record<string, unknown>;
    const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
    if (includeDeleted && !canDeleteCollection(user, "faculty")) {
      return reply.status(403).send({
        type: "forbidden",
        message: "Viewing deleted faculty requires delete permissions",
      });
    }
    const skipCount = isQueryFlagTrue(query?.skipCount);
    const result = await withTenant(
      String(request.tenant?.id),
      () => facultyUseCases.loadFacultyPage({ ...query, includeDeleted, skipCount }),
      { readOnly: true },
    );
    const sourceList = (result.faculty ?? []) as Faculty[];
    const sanitized = await sanitizeFacultyForUser(sourceList, user);
    return reply.status(200).send({ ...result, faculty: sanitized });
  });

  fastify.get<{ Params: { id: string } }>("/api/v1/tenant/faculty/:id", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, "faculty")) {
      return reply.status(403).send({ type: "forbidden", message: "Insufficient permissions" });
    }
    const query = request.query as Record<string, unknown>;
    const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
    if (includeDeleted && !canDeleteCollection(user, "faculty")) {
      return reply.status(403).send({
        type: "forbidden",
        message: "Viewing deleted faculty requires delete permissions",
      });
    }
    const item = await withTenant(
      String(request.tenant?.id),
      () => facultyUseCases.loadFacultyById(request.params.id, includeDeleted),
      { readOnly: true },
    );
    if (!item) {
      return reply.status(404).send({ type: "not_found", message: "Faculty member not found" });
    }
    const sanitized = await sanitizeOneFacultyForUser(item as Faculty, user);
    return reply.status(200).send({ faculty: sanitized });
  });

  await fastify.register(facultyCrudRoutes);
}
