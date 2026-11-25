import type { FastifyInstance } from "fastify";
import { createModuleAccessGuard } from "@mms/be-core/auth";
import { markRequestDiagnosticStage } from "../lib/requestDiagnostics.js";
import { loadModuleAvailability } from "../lib/moduleAvailabilityService.js";
import { resolveCurrentTenantRole } from "../lib/currentTenantRole.js";
import { resolveModuleRouteAction } from "../lib/moduleRouteActions.js";

const guard = createModuleAccessGuard({
  loadAvailability: loadModuleAvailability,
  resolveRole: resolveCurrentTenantRole,
  resolveAction: (method, url, moduleId, explicit) =>
    resolveModuleRouteAction(method, url, moduleId, explicit),
  markStage: markRequestDiagnosticStage,
});

export const sendModuleAccessDenied = guard.sendDenied;
export const checkModuleAccess = guard.check;
export const getModuleAccessDenial = guard.getDenial;
export const pickReadableModuleSections = guard.pickReadableSections;
export const enforceModuleAccess = guard.enforce;
export const moduleAccessGuard = guard.moduleAccessGuard;

/**
 * Declares a Fastify plugin scope as owned by `moduleId`: stamps every route
 * registered afterwards with its module and required action, then gates each
 * request on grant, enablement, and that action's permission.
 */
export function registerModuleAccess(fastify: FastifyInstance, moduleId: string): void {
  guard.registerModuleAccess(fastify, moduleId);
}
