import type { FastifyInstance } from "fastify";
import { registerCsvExportRoutes } from "../deps.js";

/**
 * Contacts copy of the shared CSV-export route registrar.
 *
 * The app's registrar owns CSV streaming/queue wiring, so the module delegates
 * to the kernel dep the composition root binds instead of importing `apps/**`.
 */
export function registerModuleCsvExportRoutes(
  fastify: FastifyInstance,
  options: Record<string, unknown>,
): Promise<void> | void {
  return registerCsvExportRoutes(fastify, options);
}
