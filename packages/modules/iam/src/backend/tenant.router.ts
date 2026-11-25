import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { User } from "@mms/contracts";
import {
  createWorkspaceUserSchema,
  editWorkspaceUserSchema,
  inviteWorkspaceUserSchema,
  usersListQuerySchema,
} from "@mms/contracts";
import { getRequestTenant } from "@mms/be-core/http";
import type { IamService } from "./iam.service.js";
export { createIamService } from "./iam.service.js";
export type { IamPorts, TenantIamPort, PlatformIamPort } from "./ports.js";
import type { IamTenantContext } from "../shared/types.js";
import { sendIamError } from "./respond.js";

export interface TenantIamRouterOptions {
  service: IamService;
}

function tenantContext(request: FastifyRequest): IamTenantContext | null {
  const tenant =
    (request as FastifyRequest & { tenant?: { id: string } }).tenant?.id ?? getRequestTenant();
  const user = (request as FastifyRequest & { user?: User }).user;
  if (!tenant || !user) return null;
  return {
    tenantId: tenant,
    actor: { id: user.id, role: user.role, name: user.name },
    ip: request.ip,
    requestId: request.id,
  };
}

export const tenantIamRoutes: FastifyPluginAsync<TenantIamRouterOptions> = async (app, opts) => {
  const service = opts.service;

  app.get("/api/iam/members", async (request, reply) => {
    const ctx = tenantContext(request);
    if (!ctx) return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    const parsed = usersListQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success)
      return reply.status(400).send({ type: "bad_request", message: parsed.error.message });
    try {
      return reply.send(await service.listMembers(ctx, parsed.data as Record<string, unknown>));
    } catch (error) {
      return sendIamError(reply, error);
    }
  });

  app.get("/api/iam/roles", async (request, reply) => {
    const ctx = tenantContext(request);
    if (!ctx) return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    try {
      return reply.send({ roles: await service.listRoles(ctx) });
    } catch (error) {
      return sendIamError(reply, error);
    }
  });

  app.post("/api/iam/members", async (request, reply) => {
    const ctx = tenantContext(request);
    if (!ctx) return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    const parsed = createWorkspaceUserSchema.safeParse(request.body ?? {});
    if (!parsed.success)
      return reply.status(400).send({ type: "bad_request", message: parsed.error.message });
    try {
      return reply.send(await service.createMember(ctx, parsed.data));
    } catch (error) {
      return sendIamError(reply, error);
    }
  });

  app.post("/api/iam/members/invite", async (request, reply) => {
    const ctx = tenantContext(request);
    if (!ctx) return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    const parsed = inviteWorkspaceUserSchema.safeParse(request.body ?? {});
    if (!parsed.success)
      return reply.status(400).send({ type: "bad_request", message: parsed.error.message });
    try {
      return reply.send(await service.inviteMember(ctx, parsed.data));
    } catch (error) {
      return sendIamError(reply, error);
    }
  });

  app.patch("/api/iam/members/:id", async (request, reply) => {
    const ctx = tenantContext(request);
    if (!ctx) return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    const params = request.params as { id: string };
    const parsed = editWorkspaceUserSchema.partial().safeParse(request.body ?? {});
    if (!parsed.success)
      return reply.status(400).send({ type: "bad_request", message: parsed.error.message });
    try {
      return reply.send({ user: await service.updateMember(ctx, params.id, parsed.data) });
    } catch (error) {
      return sendIamError(reply, error);
    }
  });

  app.delete("/api/iam/members/:id", async (request, reply) => {
    const ctx = tenantContext(request);
    if (!ctx) return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    try {
      const removed = await service.removeMember(ctx, (request.params as { id: string }).id);
      return reply.send({ success: removed });
    } catch (error) {
      return sendIamError(reply, error);
    }
  });

  app.post("/api/iam/members/:id/restore", async (request, reply) => {
    const ctx = tenantContext(request);
    if (!ctx) return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    try {
      const restored = await service.restoreMember(ctx, (request.params as { id: string }).id);
      return reply.send({ success: restored });
    } catch (error) {
      return sendIamError(reply, error);
    }
  });

  app.post("/api/iam/members/:id/reset-password", async (request, reply) => {
    const ctx = tenantContext(request);
    if (!ctx) return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    const body = request.body as { temporaryPassword?: unknown } | undefined;
    if (typeof body?.temporaryPassword !== "string" || body.temporaryPassword.length === 0) {
      return reply
        .status(400)
        .send({ type: "bad_request", message: "temporaryPassword is required" });
    }
    try {
      const reset = await service.resetMemberPassword(
        ctx,
        (request.params as { id: string }).id,
        body.temporaryPassword,
      );
      return reply.send({ success: reset });
    } catch (error) {
      return sendIamError(reply, error);
    }
  });
};
