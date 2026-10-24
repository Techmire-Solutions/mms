import type { FastifyInstance } from "fastify";
import type { ZodTypeAny } from "zod";
import type { Permission, User } from "@mms/shared";
import { roleHasPermission } from "@mms/shared";
import { sendDatabaseError, sendForbidden } from "./httpErrors.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";

export type RegisterModuleLookupRoutesOptions<TKind extends string = string, TItems = unknown> = {
  canRead: (user: User) => boolean;
  setupWritePermission: Permission;
  kindParamsSchema: ZodTypeAny;
  putBodySchema: ZodTypeAny;
  loadMap: () => Promise<unknown>;
  replaceKind: (kind: TKind, items: TItems) => Promise<unknown>;
  audit: (user: User, action: string, summary: string, entityId: string) => Promise<void>;
  auditAction: string;
  loadError: string;
  saveError: string;
  /**
   * Optional Contacts-style special cases (country validation, relationships mirror).
   * Return a Fastify reply to short-circuit; return null to continue with replaceKind.
   */
  handlePutKind?: (input: {
    user: User;
    kind: TKind;
    items: TItems;
    reply: import("fastify").FastifyReply;
  }) => Promise<import("fastify").FastifyReply | null | undefined>;
};

/**
 * Register GET `/lookups` + PUT `/lookups/:kind` for module Setup.
 */
export function registerModuleLookupRoutes<TKind extends string = string, TItems = unknown>(
  fastify: FastifyInstance,
  options: RegisterModuleLookupRoutesOptions<TKind, TItems>,
): void {
  fastify.get("/lookups", async (request, reply) => {
    const user = request.user as User;
    if (!options.canRead(user)) return sendForbidden(reply);
    try {
      const lookups = await options.loadMap();
      return reply.send({ lookups });
    } catch (error: unknown) {
      return sendDatabaseError(reply, options.loadError, error);
    }
  });

  fastify.put("/lookups/:kind", async (request, reply) => {
    const user = request.user as User;
    if (!roleHasPermission(user.role, options.setupWritePermission)) {
      return sendForbidden(reply);
    }

    const params = parseRequest(options.kindParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);

    const body = parseRequest(options.putBodySchema, request.body);
    if (!body.ok) return replyValidationError(reply, body.message);

    const kind = String((params.data as { kind: string }).kind) as TKind;
    const items = (body.data as { items: unknown }).items as TItems;

    if (options.handlePutKind) {
      const early = await options.handlePutKind({ user, kind, items, reply });
      if (early) return early;
    }

    try {
      const saved = await options.replaceKind(kind, items);
      const count = Array.isArray(saved) ? saved.length : 0;
      await options.audit(
        user,
        options.auditAction,
        `Updated lookup kind "${kind}" (${count} items)`,
        `lookups:${kind}`,
      );
      return reply.send({ success: true, kind, items: saved });
    } catch (error: unknown) {
      return sendDatabaseError(reply, options.saveError, error);
    }
  });
}
