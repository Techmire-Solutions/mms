import type { FastifyRequest } from "fastify";
import { getPoolMetrics } from "../db/dbConnection.js";
import { checkIsRedisConnected } from "./redis.js";

export interface RequestDiagnosticContext {
  operation: string;
  stage: string;
}

declare module "fastify" {
  interface FastifyRequest {
    diagnosticContext?: RequestDiagnosticContext;
  }
}

export function startRequestDiagnostics(request: FastifyRequest, operation: string): void {
  request.diagnosticContext = { operation, stage: "request_received" };
}

export function markRequestDiagnosticStage(request: FastifyRequest, stage: string): void {
  if (request.diagnosticContext) {
    request.diagnosticContext.stage = stage;
  }
}

export function getRequestDiagnosticContext(
  request: FastifyRequest,
): RequestDiagnosticContext | undefined {
  return request.diagnosticContext;
}

export function dependencyForDiagnosticStage(stage?: string): string | undefined {
  if (!stage) return undefined;
  if (
    stage === "authentication_tenant_blocklist" ||
    stage === "authentication_token_revocation" ||
    stage === "authentication_user_session_revocation" ||
    stage === "session_revocation"
  ) {
    return "redis";
  }
  if (
    stage.includes("workspace_lookup") ||
    stage.includes("module_access") ||
    stage === "load_user" ||
    stage === "password_policy" ||
    stage === "credential_transaction" ||
    stage === "credential_update" ||
    stage === "refresh_token_revocation"
  ) {
    return "database";
  }
  if (stage === "password_hash") return "crypto";
  if (stage === "rate_limit") return "rate_limiter";
  return undefined;
}

/** Safe operational state for server logs. Never includes URLs, credentials, or tokens. */
export function getRuntimeDependencySnapshot(): Record<string, unknown> {
  const pool = getPoolMetrics();
  const redisConfigured = Boolean(process.env.REDIS_URL?.trim());
  const redisConnected = checkIsRedisConnected();
  return {
    database: {
      initialized: pool !== null,
      pool,
    },
    redis: {
      configured: redisConfigured,
      connected: redisConnected,
      storageMode: redisConnected ? "redis" : "memory_fallback",
    },
  };
}
