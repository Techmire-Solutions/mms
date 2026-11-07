import { z } from "zod";
import { SessionSchema } from "../sessions/sessionTypes.js";

/** Standard sessions error envelope (`violations` carries lifecycle/completion gate codes). */
export const sessionErrorResponseSchema = z
  .object({
    type: z.string(),
    message: z.string(),
    violations: z.array(z.string()).optional(),
  })
  .passthrough();

/** Bounded session path parameter shared by every sessions route. */
export const sessionIdParamsSchema = z.object({ id: z.string().trim().min(1).max(64) });

/**
 * Public session shape: server-owned overlap-control fields and internal actor ids never leave
 * the API. `version` stays because clients echo it as the optimistic-concurrency token.
 */
export const sessionResponseSchema = z.object(
  SessionSchema.omit({ overlapExempt: true, deletedBy: true, restoredBy: true }).shape,
);
/** Public wire shape; distinct from the internal `Session` aggregate (which carries server fields). */
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

const error = sessionErrorResponseSchema;

/** Statuses every sessions read route may return (auth middleware owns the 401). */
export const sessionReadErrors = {
  400: error,
  401: error,
  403: error,
  404: error,
  500: error,
} as const;

/** Statuses every sessions mutation may return (409/428 for OCC and lifecycle guards). */
export const sessionWriteErrors = {
  400: error,
  401: error,
  403: error,
  404: error,
  409: error,
  428: error,
  500: error,
} as const;
