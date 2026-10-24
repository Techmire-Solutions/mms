import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  evaluateModuleAccess,
  resolveAccessModuleId,
  roleHasPermission,
  type AccessControlledModuleId,
  type ModuleAccessDecision,
  type ModuleAccessDenialCode,
  type ModuleAccessDeniedBody,
  type ModuleAction,
  type User,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { loadModuleAvailability } from "../lib/moduleAvailabilityService.js";
import { resolveCurrentTenantRole } from "../lib/currentTenantRole.js";
import { resolveModuleRouteAction } from "../lib/moduleRouteActions.js";
import { markRequestDiagnosticStage } from "../lib/requestDiagnostics.js";
import { logger } from "../lib/logger.js";

declare module "fastify" {
  interface FastifyContextConfig {
    /** Stamped by `registerModuleAccess`; read by `moduleAccessGuard` and the coverage test. */
    moduleAccess?: { moduleId: AccessControlledModuleId; action: ModuleAction };
    /** Optional explicit action for a hand-written module route. */
    moduleAction?: ModuleAction;
  }
}

const DENIAL_MESSAGES: Record<ModuleAccessDenialCode, (moduleId: string) => string> = {
  MODULE_NOT_GRANTED: (id) => `The ${id} module is not permitted by the platform.`,
  MODULE_DISABLED: (id) => `The ${id} module is disabled for this workspace.`,
  PERMISSION_DENIED: () => "Insufficient permissions",
  MODULE_ACCESS_UNAVAILABLE: () => "Failed to verify module access",
};

export function sendModuleAccessDenied(
  reply: FastifyReply,
  code: ModuleAccessDenialCode,
  moduleId: string,
): FastifyReply {
  const body: ModuleAccessDeniedBody = {
    type: "forbidden",
    code,
    moduleId,
    message: DENIAL_MESSAGES[code](moduleId),
  };
  return reply.status(403).send(body);
}

/**
 * Evaluates grant → enablement → action permission from server-side state only:
 * the auth-verified tenant, the JWT-verified user, and the workspace row.
 */
export async function checkModuleAccess(
  request: FastifyRequest,
  moduleId: string,
  action: ModuleAction,
): Promise<ModuleAccessDecision> {
  const tenant = request.tenant?.id ?? getRequestTenant();
  const user = request.user as User | undefined;
  if (!tenant || !user?.role) return { allowed: false, code: "MODULE_ACCESS_UNAVAILABLE" };
  if (user.workspaceSubdomain && user.workspaceSubdomain.toLowerCase() !== tenant.toLowerCase()) {
    return { allowed: false, code: "MODULE_ACCESS_UNAVAILABLE" };
  }
  try {
    const availability = await loadModuleAvailability(tenant);
    const role = user.id
      ? await resolveCurrentTenantRole(tenant, String(user.id), user.role)
      : user.role;
    return evaluateModuleAccess({
      moduleId,
      availability,
      action,
      can: (permission) => role !== null && roleHasPermission(role, permission),
    });
  } catch (err) {
    logger.error({ err, moduleId, tenant }, "Failed to load module availability; denying request");
    return { allowed: false, code: "MODULE_ACCESS_UNAVAILABLE" };
  }
}

/** Denial body for contract handlers that return responses instead of using `reply`; null when allowed. */
export async function getModuleAccessDenial(
  request: FastifyRequest,
  moduleId: string,
  action: ModuleAction,
): Promise<ModuleAccessDeniedBody | null> {
  const decision = await checkModuleAccess(request, moduleId, action);
  if (decision.allowed) return null;
  const id = resolveAccessModuleId(moduleId) ?? moduleId;
  return {
    type: "forbidden",
    code: decision.code,
    moduleId: id,
    message: DENIAL_MESSAGES[decision.code](id),
  };
}

/**
 * Keeps only the sections of a cross-module payload (keyed by module id) the
 * caller may read; unknown keys are dropped so new sections fail closed.
 */
export async function pickReadableModuleSections<T extends object>(
  request: FastifyRequest,
  sections: T,
): Promise<Partial<T>> {
  const entries = Object.entries(sections) as [keyof T & string, T[keyof T & string]][];
  const decisions = await Promise.all(
    entries.map(([moduleId]) => checkModuleAccess(request, moduleId, "read")),
  );
  const visible: Partial<T> = {};
  entries.forEach(([key, value], i) => {
    if (decisions[i]?.allowed) visible[key] = value;
  });
  return visible;
}

/** In-handler gate for routes whose module is only known per request. Returns false after replying 403. */
export async function enforceModuleAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  moduleId: string,
  action: ModuleAction,
): Promise<boolean> {
  const denial = await getModuleAccessDenial(request, moduleId, action);
  if (!denial) return true;
  await reply.status(403).send(denial);
  return false;
}

export async function moduleAccessGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  markRequestDiagnosticStage(request, "module_access");
  const access = request.routeOptions.config.moduleAccess;
  if (!access) {
    await sendModuleAccessDenied(reply, "MODULE_ACCESS_UNAVAILABLE", "unknown");
    return;
  }
  await enforceModuleAccess(request, reply, access.moduleId, access.action);
}

/**
 * Declares a Fastify plugin scope as owned by `moduleId`: stamps every route
 * registered afterwards (including child plugins) with its module and required
 * action, and gates each request on grant, enablement, and that action's
 * permission. Call right after `authenticateTenant`, before registering routes.
 */
export function registerModuleAccess(fastify: FastifyInstance, moduleId: string): void {
  const canonical = resolveAccessModuleId(moduleId);
  if (!canonical) throw new Error(`registerModuleAccess: unknown module "${moduleId}"`);
  fastify.addHook("onRoute", (route) => {
    const config = route.config ?? {};
    route.config = {
      ...config,
      moduleAccess: {
        moduleId: canonical,
        action: resolveModuleRouteAction(route.method, route.url, canonical, config.moduleAction),
      },
    };
  });
  fastify.addHook("preHandler", moduleAccessGuard);
}
