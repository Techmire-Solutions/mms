import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import { AUTH_RATE_LIMIT } from "./rateLimitConfig.js";
import { createStrictRateLimitGuard } from "./rateLimitGuard.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";
import type { IntegrationTestableConfig } from "./createIntegrationConfigService.js";

/**
 * Generic GET/PUT `/integration` + POST `/integration/test` route registry
 * shared by the five tenant/platform SMS/email/WhatsApp integration route
 * files (mms-dry §2).
 *
 * The handlers are byte-identical across consoles apart from the authorization
 * gate (`canWriteObject(user, "<kind>_integration")` on the tenant console vs
 * the platform `requirePlatformPermission("settings")` pre-handler) and the
 * per-kind config merge / test-send step, both supplied by the adapter.
 */

export interface IntegrationTestOutcome {
  sent: boolean;
  reason?: string;
  /** Message passed to markTestResult on failure (falls back to reason). */
  markMessage?: string;
  /** Validation-error message (falls back to `testFailureMessage`). */
  replyMessage?: string;
}

export interface RegisterIntegrationRoutesOptions<
  TConfig extends IntegrationTestableConfig,
  TSecrets,
  TBody extends { providerId: string },
  TTestBody,
> {
  /** Zod schema for PUT /integration. */
  integrationBodySchema: ZodType<TBody>;
  /**
   * Zod schema for POST /integration/test. When omitted the body is not parsed
   * (platform email ignores the body and targets the session user).
   */
  testBodySchema?: ZodType<TTestBody>;
  /** Provider-id validator for the PUT body. */
  isProviderId(providerId: string): boolean;
  /** Provider validation failure message. */
  unsupportedProviderMessage: string;
  /** Loads the current config. */
  load(): Promise<TConfig>;
  /** Saves the canonicalized config and returns the stored value. */
  save(config: TConfig): Promise<TConfig>;
  /** Persists a freshly supplied secret. */
  saveSecrets(secrets: TSecrets): Promise<void>;
  /** Builds the next config from current + body (merge*IntegrationConfig block). */
  buildNext(current: TConfig, body: TBody): TConfig;
  /** Trimmed secret from the body, or undefined. */
  secretFromBody(body: TBody): string | undefined;
  /** Wraps a trimmed secret into the secrets payload. */
  secretsFromSecret(secret: string): TSecrets;
  /** Runs the test send; receives the parsed body (`undefined` when no schema is set). */
  testSend(request: FastifyRequest, body: TTestBody): Promise<IntegrationTestOutcome>;
  /** Marks the test result. */
  markTestResult(ok: boolean, errorMessage?: string): Promise<TConfig>;
  /** Per-route authorization gate; returns false after writing the 403. */
  authGate(request: FastifyRequest, reply: FastifyReply): boolean;
  /** Fallback validation-error message when the outcome carries none. */
  testFailureMessage: string;
  /**
   * Optional post-mutation audit hook (platform consoles use it to record an
   * apex activity-log row; tenant consoles keep their own audit helper).
   */
  audit?(request: FastifyRequest, action: string, metadataMessage?: string): Promise<void> | void;
}

export function registerIntegrationRoutes<
  TConfig extends IntegrationTestableConfig,
  TSecrets,
  TBody extends { providerId: string },
  TTestBody,
>(
  fastify: FastifyInstance,
  options: RegisterIntegrationRoutesOptions<TConfig, TSecrets, TBody, TTestBody>,
  registerHooks?: (instance: FastifyInstance) => void,
): void {
  registerHooks?.(fastify);

  // Sending a message is a side-effect with real per-message cost and abuse
  // potential — keep it on the strict auth budget rather than the 300/min
  // global default.
  const sendLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.get("/integration", async (request, reply) => {
    if (!options.authGate(request, reply)) return;
    const config = await options.load();
    return reply.send(config);
  });

  fastify.put("/integration", async (request, reply) => {
    if (!options.authGate(request, reply)) return;

    const parsed = parseRequest(options.integrationBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const body = parsed.data;

    if (!options.isProviderId(body.providerId)) {
      return replyValidationError(reply, options.unsupportedProviderMessage);
    }

    const current = await options.load();
    const next = options.buildNext(current, body);

    const secret = options.secretFromBody(body);
    if (secret) {
      await options.saveSecrets(options.secretsFromSecret(secret));
      next.hasCredentials = true;
    }

    const saved = await options.save(next);
    await options.audit?.(request, "update_integration", `providerId=${body.providerId}`);
    return reply.send(saved);
  });

  fastify.post("/integration/test", { preHandler: sendLimit }, async (request, reply) => {
    if (!options.authGate(request, reply)) return;

    let body: TTestBody | undefined;
    if (options.testBodySchema) {
      const parsed = parseRequest(options.testBodySchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);
      body = parsed.data;
    }

    // `body` is always defined when a testBodySchema is configured; flows
    // without one receive undefined and must not read it.
    const outcome = await options.testSend(request, body as TTestBody);
    if (!outcome.sent) {
      await options.markTestResult(false, outcome.markMessage ?? outcome.reason);
      return replyValidationError(reply, outcome.replyMessage ?? options.testFailureMessage, {
        reason: outcome.reason,
      });
    }

    const saved = await options.markTestResult(true);
    await options.audit?.(request, "test_integration");
    return reply.send({ success: true, config: saved });
  });
}
