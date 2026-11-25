import type { FastifyPluginAsync } from "fastify";

let extras: FastifyPluginAsync[] = [];
export function configureAccountingExtraRoutes(plugins: FastifyPluginAsync[]): void {
  extras = plugins;
}
export function getAccountingExtraRoutes(): FastifyPluginAsync[] {
  return extras;
}
