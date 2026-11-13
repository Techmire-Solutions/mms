import type { FastifyInstance } from "fastify";
import { installContractErrorHandler } from "./contractRegistration.js";

/**
 * Back-compat alias: the sessions routers install the shared contract error
 * handler (renamed once the accounting and finance routers adopted it too).
 */
export function installSessionsContractErrorHandler(fastify: FastifyInstance): void {
  installContractErrorHandler(fastify);
}
