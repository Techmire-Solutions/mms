import type { FastifyInstance } from "fastify";

export interface AccountingExportRouteDeps {
  registerCsvExportRoutes(
    fastify: FastifyInstance,
    options: Record<string, unknown>,
  ): void | Promise<void>;
  registerCsvImportRoutes(
    fastify: FastifyInstance,
    options: Record<string, unknown>,
  ): void | Promise<void>;
}

let deps: AccountingExportRouteDeps | null = null;
export function configureAccountingExportRouteDeps(value: AccountingExportRouteDeps): void {
  deps = value;
}
export function getAccountingExportRouteDeps(): AccountingExportRouteDeps {
  if (!deps) throw new Error("Accounting export route dependencies are not configured");
  return deps;
}
