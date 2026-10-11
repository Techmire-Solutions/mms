import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import { studentSetupConfigRoutes } from "./students/studentSetupConfigRoutes.js";
import { studentLookupRoutes } from "./students/studentLookupRoutes.js";
import { studentExportRoutes } from "./students/studentExportRoutes.js";
import { studentAggregateRoutes } from "./students/studentAggregateRoutes.js";
import { studentSoftDeleteRoutes } from "./students/studentSoftDeleteRoutes.js";
import { studentCrudRoutes } from "./students/studentCrudRoutes.js";
import { studentOperationRoutes } from "./students/studentOperationRoutes.js";

/**
 * Server-first student resource routes (TanStack Query on FE).
 */
export default async function studentsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "students");

  await fastify.register(studentSetupConfigRoutes, { prefix: "/api/students" });
  await fastify.register(studentLookupRoutes, { prefix: "/api/students" });
  await fastify.register(studentExportRoutes, { prefix: "/api/students" });
  await fastify.register(studentSoftDeleteRoutes, { prefix: "/api/students" });
  await fastify.register(studentAggregateRoutes, { prefix: "/api/students" });
  await fastify.register(studentOperationRoutes);
  await fastify.register(studentCrudRoutes);
}
