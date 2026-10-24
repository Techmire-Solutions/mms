import type { FastifyReply, FastifyRequest } from "fastify";
import { getRequestTenant } from "../lib/tenantContext.js";
import { authenticateTenant } from "./authenticate.js";
import { authenticatePlatform } from "./authenticatePlatform.js";

/**
 * Tenant sessions on subdomains; platform sessions on apex (onboarding branding).
 */
export async function authenticateUploader(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const tenant = getRequestTenant();
  if (tenant) {
    await authenticateTenant(request, reply);
  } else {
    await authenticatePlatform(request, reply);
  }
  if (reply.sent) {
    return;
  }
}
