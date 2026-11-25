import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { studentSetupConfigRoutes } from "./routes/studentSetupConfigRoutes.js";
import { studentLookupRoutes } from "./routes/studentLookupRoutes.js";
import { studentExportRoutes } from "./routes/studentExportRoutes.js";
import { studentAggregateRoutes } from "./routes/studentAggregateRoutes.js";
import { studentSoftDeleteRoutes } from "./routes/studentSoftDeleteRoutes.js";
import { studentCrudRoutes } from "./routes/studentCrudRoutes.js";
import { studentOperationRoutes } from "./routes/studentOperationRoutes.js";

/**
 * Server-first student resource routes (TanStack Query on FE).
 */
export default async function studentsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(studentSetupConfigRoutes, { prefix: "/api/students" });
  await fastify.register(studentLookupRoutes, { prefix: "/api/students" });
  await fastify.register(studentExportRoutes, { prefix: "/api/students" });
  await fastify.register(studentSoftDeleteRoutes, { prefix: "/api/students" });
  await fastify.register(studentAggregateRoutes, { prefix: "/api/students" });
  await fastify.register(studentOperationRoutes);
  await fastify.register(studentCrudRoutes);
}
