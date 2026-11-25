import type { FastifyInstance } from "fastify";

/**
 * The app-runtime seam a module uses to register its CSV export/import routes
 * without importing the app's route factories. `apps/api` configures this once
 * at startup with `registerModuleCsvExportRoutes` / `registerModuleCsvImportRoutes`.
 *
 * The option objects stay `Record<string, unknown>` here so the shared seam does
 * not import the module-specific schema types; the app casts them at the boundary.
 */
export interface CsvRouteDeps {
  registerCsvExportRoutes(fastify: FastifyInstance, options: Record<string, unknown>): void;
  registerCsvImportRoutes(fastify: FastifyInstance, options: Record<string, unknown>): void;
}

let deps: CsvRouteDeps | null = null;

export function configureCsvRouteDeps(port: CsvRouteDeps): void {
  deps = port;
}

export function getCsvRouteDeps(): CsvRouteDeps {
  if (!deps) throw new Error("CSV route deps are not configured");
  return deps;
}
