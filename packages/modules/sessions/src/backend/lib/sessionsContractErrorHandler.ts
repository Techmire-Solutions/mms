import type { FastifyInstance } from "fastify";
import { installContractErrorHandler } from "@mms/be-core/http/routes";

/**
 * Back-compat alias: the sessions routers install the shared contract error
 * handler (renamed once the accounting and finance routers adopted it too).
 */
export function installSessionsContractErrorHandler(fastify: FastifyInstance): void {
  installContractErrorHandler(fastify);
}
