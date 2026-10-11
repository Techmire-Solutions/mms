import type { FastifyRequest, FastifyReply } from "fastify";
import type { ZodType } from "zod";
import { getRequestTenant } from "./tenantContext.js";

type ParseResult<T> = { ok: true; data: T } | { ok: false; message: string };

export function parseRequest<T>(schema: ZodType<T>, value: unknown): ParseResult<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.message };
  }
  return { ok: true, data: parsed.data };
}

export function replyValidationError(
  reply: FastifyReply,
  message = "Invalid request",
  extraFields?: Record<string, unknown>,
): ReturnType<FastifyReply["status"]> {
  return reply.status(400).send({ type: "validation_error", message, ...extraFields });
}

/**
 * Centrally manages accept-language parsing, tenant retrieval, dynamic validation exception handling, and bad request replies.
 */
export async function executeDynamicValidation(
  request: FastifyRequest,
  reply: FastifyReply,
  validateFn: (tenant: string, lang: string) => Promise<unknown>,
): Promise<boolean> {
  const tenant = getRequestTenant();
  if (!tenant) {
    replyValidationError(reply, "Tenant context required");
    return false;
  }
  try {
    const lang = (request.headers["accept-language"] as string) || "en";
    await validateFn(tenant, lang);
    return true;
  } catch (error) {
    replyValidationError(reply, error instanceof Error ? error.message : String(error));
    return false;
  }
}

export function validateOrThrow(schema: ZodType<unknown>, value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = schema.safeParse(item);
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
      }
    }
  } else {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
    }
  }
}
