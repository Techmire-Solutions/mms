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
  type ModuleAvailabilityMap,
  type User,
} from "@mms/contracts";
import { getRequestTenant } from "@mms/db/request-context";
import { logger } from "../logger/index.js";
import { getUserRoleCatalog } from "../rbac/userPermissionContext.js";

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

export interface ModuleAccessPorts {
  loadAvailability(tenant: string): Promise<ModuleAvailabilityMap>;
  resolveRole(tenant: string, userId: string, fallbackRole?: string): Promise<string | null>;
  resolveAction(
    method: string,
    url: string,
    moduleId: string,
    explicit?: ModuleAction,
  ): ModuleAction;
  /** Optional perf/diagnostic stage marker (app request diagnostics). */
  markStage?(request: FastifyRequest, stage: string): void;
}

export interface ModuleAccessGuard {
  sendDenied(reply: FastifyReply, code: ModuleAccessDenialCode, moduleId: string): FastifyReply;
  check(
    request: FastifyRequest,
    moduleId: string,
    action: ModuleAction,
  ): Promise<ModuleAccessDecision>;
  getDenial(
    request: FastifyRequest,
    moduleId: string,
    action: ModuleAction,
  ): Promise<ModuleAccessDeniedBody | null>;
  pickReadableSections<T extends object>(request: FastifyRequest, sections: T): Promise<Partial<T>>;
  enforce(
    request: FastifyRequest,
    reply: FastifyReply,
    moduleId: string,
    action: ModuleAction,
  ): Promise<boolean>;
  moduleAccessGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  registerModuleAccess(fastify: FastifyInstance, moduleId: string): void;
}

export function createModuleAccessGuard(ports: ModuleAccessPorts): ModuleAccessGuard {
  function sendDenied(
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

  async function check(
    request: FastifyRequest,
    moduleId: string,
    action: ModuleAction,
  ): Promise<ModuleAccessDecision> {
    const tenant =
      (request as unknown as { tenant?: { id: string } }).tenant?.id ?? getRequestTenant();
    const user = (request as unknown as { user?: User }).user;
    if (!tenant || !user?.role) return { allowed: false, code: "MODULE_ACCESS_UNAVAILABLE" };
    if (user.workspaceSubdomain && user.workspaceSubdomain.toLowerCase() !== tenant.toLowerCase()) {
      return { allowed: false, code: "MODULE_ACCESS_UNAVAILABLE" };
    }
    try {
      const availability = await ports.loadAvailability(tenant);
      const role = user.id
        ? await ports.resolveRole(tenant, String(user.id), user.role)
        : user.role;
      // Custom/composite roles live in the catalog attached at authentication;
      // system roles fall back to the default permission map.
      const roleCatalog = getUserRoleCatalog(user);
      return evaluateModuleAccess({
        moduleId,
        availability,
        action,
        can: (permission) => role !== null && roleHasPermission(role, permission, roleCatalog),
      });
    } catch (err) {
      logger.error(
        { err, moduleId, tenant },
        "Failed to load module availability; denying request",
      );
      return { allowed: false, code: "MODULE_ACCESS_UNAVAILABLE" };
    }
  }

  async function getDenial(
    request: FastifyRequest,
    moduleId: string,
    action: ModuleAction,
  ): Promise<ModuleAccessDeniedBody | null> {
    const decision = await check(request, moduleId, action);
    if (decision.allowed) return null;
    const id = resolveAccessModuleId(moduleId) ?? moduleId;
    return {
      type: "forbidden",
      code: decision.code,
      moduleId: id,
      message: DENIAL_MESSAGES[decision.code](id),
    };
  }

  async function pickReadableSections<T extends object>(
    request: FastifyRequest,
    sections: T,
  ): Promise<Partial<T>> {
    const entries = Object.entries(sections) as [keyof T & string, T[keyof T & string]][];
    const decisions = await Promise.all(
      entries.map(([moduleId]) => check(request, moduleId, "read")),
    );
    const visible: Partial<T> = {};
    entries.forEach(([key, value], i) => {
      if (decisions[i]?.allowed) visible[key] = value;
    });
    return visible;
  }

  async function enforce(
    request: FastifyRequest,
    reply: FastifyReply,
    moduleId: string,
    action: ModuleAction,
  ): Promise<boolean> {
    const denial = await getDenial(request, moduleId, action);
    if (!denial) return true;
    await reply.status(403).send(denial);
    return false;
  }

  async function moduleAccessGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    ports.markStage?.(request, "module_access");
    const access = request.routeOptions.config.moduleAccess;
    if (!access) {
      await sendDenied(reply, "MODULE_ACCESS_UNAVAILABLE", "unknown");
      return;
    }
    await enforce(request, reply, access.moduleId, access.action);
  }

  function registerModuleAccess(fastify: FastifyInstance, moduleId: string): void {
    const canonical = resolveAccessModuleId(moduleId);
    if (!canonical) throw new Error(`registerModuleAccess: unknown module "${moduleId}"`);
    fastify.addHook("onRoute", (route) => {
      const config = route.config ?? {};
      route.config = {
        ...config,
        moduleAccess: {
          moduleId: canonical,
          action: ports.resolveAction(
            Array.isArray(route.method) ? (route.method[0] ?? "GET") : route.method,
            route.url,
            canonical,
            config.moduleAction,
          ),
        },
      };
    });
    fastify.addHook("preHandler", moduleAccessGuard);
  }

  return {
    sendDenied,
    check,
    getDenial,
    pickReadableSections,
    enforce,
    moduleAccessGuard,
    registerModuleAccess,
  };
}
