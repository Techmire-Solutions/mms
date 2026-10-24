import type { FastifyRequest } from "fastify";
import { roleHasPermission, type Permission, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { HttpDomainError } from "../../../lib/httpErrors.js";
import { runWithTenant } from "../../../lib/tenantContext.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";

export type WorkshopAccess = "read" | "write" | "delete";

/** Either collection-level access (module data) or a single permission (Setup). */
export type WorkshopRule =
  { collection: string; access: WorkshopAccess } | { permission: Permission };

export const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};

type ErrorResult = { status: number; body: { type: string; message: string } };

function allowed(user: User, rule: WorkshopRule): boolean {
  if ("permission" in rule) return roleHasPermission(user.role, rule.permission);
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
  try {
    return await runWithTenant(String(request.tenant?.id ?? ""), () => work(user));
  } catch (error) {
    if (error instanceof HttpDomainError) {
      return { status: error.statusCode, body: { type: error.type, message: error.message } };
    }
    return handleContractError(request, error, {
      status: 500,
      body: { type: "server_error", message: failure },
    });
  }
}
