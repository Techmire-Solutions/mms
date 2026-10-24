import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import {
  getWorkspace,
  getWorkspaceWithPublicBranding,
  isSubdomainAvailable,
  listPublicWorkspaces,
  normalizeSubdomainInput,
  fetchPublicBrandingForSubdomain,
} from "../../services/workspaceService.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { sendNotFound } from "../../lib/httpErrors.js";
import { subdomainParamsSchema } from "@mms/shared";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";

export default async function workspaceRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/registry", async (_request, reply) => {
    if (getRequestTenant()) {
      return sendNotFound(reply, "Not found");
    }
    const workspaces = await listPublicWorkspaces();
    return reply.send({ workspaces });
  });

  fastify.get("/public-branding", async (_request, reply) => {
    const workspace = await getWorkspace();
    if (!workspace) {
      return sendNotFound(reply, "No workspace configured");
    }
    const branding = await fetchPublicBrandingForSubdomain(workspace.subdomain);
    return reply.send({ branding });
  });

  fastify.get("/current", async (_request, reply) => {
    const workspace = await getWorkspace();
    if (!workspace) {
      return sendNotFound(reply, "No workspace configured");
    }
    const branding = await fetchPublicBrandingForSubdomain(workspace.subdomain);
    return reply.send({ workspace, branding });
  });

  fastify.get("/by-subdomain/:subdomain", async (request, reply) => {
    const params = parseRequest(subdomainParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);

    const subdomain = normalizeSubdomainInput(params.data.subdomain);
    const result = await getWorkspaceWithPublicBranding(subdomain);
    if (!result) {
      return sendNotFound(reply, "Workspace not found");
    }

    return reply.send(result);
  });

  fastify.get("/subdomain-available/:subdomain", async (request, reply) => {
    const params = parseRequest(subdomainParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);

    const subdomain = normalizeSubdomainInput(params.data.subdomain);
    const available = await isSubdomainAvailable(subdomain);
    return reply.send({ subdomain, available });
  });
}
