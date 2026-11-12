import type { FastifyRequest } from "fastify";
import { type Permission, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { HttpDomainError } from "../../../lib/httpErrors.js";
import { runWithTenant } from "../../../lib/tenantContext.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";

export type WorkshopAccess = "read" | "write" | "delete";

/** Either collection-level access (module data) or a single permission (Setup). */
export type WorkshopRule =
  { collection: string; access: WorkshopAccess } | { permission: Permission };

export const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};

interface ErrorBody {
  type: string;
  message: string;
  /** Structured context carried by a domain error (blockers, ids, capacity…). */
  details?: Record<string, unknown>;
  /** Machine-readable reasons (e.g. blocked lifecycle transitions). */
  violations?: string[];
}

type ErrorResult = { status: number; body: ErrorBody };

function allowed(user: User, rule: WorkshopRule): boolean {
  if ("permission" in rule) return userHasPermission(user, rule.permission);
  if (rule.access === "read") return canReadCollection(user, rule.collection);
  if (rule.access === "write") return canWriteCollection(user, rule.collection);
  return canDeleteCollection(user, rule.collection);
}

/**
 * Permission check → tenant-bound use-case call → domain errors (400/404/409) keep their
 * status, anything else is logged and becomes a 500 with `failure`.
 */
export async function guarded<T>(
  request: FastifyRequest,
  rule: WorkshopRule,
  failure: string,
  work: (user: User) => Promise<T>,
): Promise<T | typeof forbidden | ErrorResult> {
  const user = request.user as User;
  if (!allowed(user, rule)) return forbidden;
  const tenant = request.tenant?.id;
  if (!tenant) {
    // Fail closed: entering the tenant callback with "" would only surface a generic 500 later.
    return forbidden;
  }
  try {
    return await runWithTenant(String(tenant), () => work(user));
  } catch (error) {
    if (error instanceof HttpDomainError) {
      // Keep the structured payload: the shared handler forwards `details`/`violations`, and the
      // workshop guard used to drop them (capacity blockers, transition violations, ids).
      const violations = (error as { violations?: unknown }).violations;
      return {
        status: error.statusCode,
        body: {
          type: error.type,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
          ...(Array.isArray(violations) ? { violations: violations.map(String) } : {}),
        },
      };
    }
    return handleContractError(request, error, {
      status: 500,
      body: { type: "server_error", message: failure },
    });
  }
}
