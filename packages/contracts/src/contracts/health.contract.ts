import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const poolSubMetricsSchema = z
  .object({
    role: z.string().optional(),
    totalCount: z.number(),
    idleCount: z.number(),
    waitingCount: z.number(),
  })
  .strict();

export const redisStatusSchema = z
  .object({
    connected: z.boolean(),
  })
  .strict();

export const cacheMetricsSchema = z
  .object({
    l1Hits: z.number(),
    l1Misses: z.number(),
    l2Hits: z.number(),
    l2Misses: z.number(),
    sets: z.number(),
    evictions: z.number(),
    inFlightCoalesced: z.number(),
    l1Size: z.number(),
    l1Bytes: z.number(),
    hitRatio: z.number().optional(),
  })
  .strict();

export const healthResponseSchema = z
  .object({
    status: z.string(),
    timestamp: z.string(),
    pool: poolSubMetricsSchema
      .extend({
        replica: poolSubMetricsSchema.optional(),
      })
      .nullable()
      .optional(),
    redis: redisStatusSchema.optional(),
    cache: cacheMetricsSchema.optional(),
  })
  .strict();

export const readyResponseSchema = z
  .object({
    status: z.string(),
    database: z.string(),
    redis: z.string().optional(),
    timestamp: z.string(),
  })
  .strict();

export const readyErrorResponseSchema = z
  .object({
    type: z.string(),
    status: z.string(),
    database: z.string(),
    redis: z.string().optional(),
  })
  .strict();

export type PoolSubMetrics = z.infer<typeof poolSubMetricsSchema>;
export type RedisStatus = z.infer<typeof redisStatusSchema>;
export type CacheMetrics = z.infer<typeof cacheMetricsSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadyResponse = z.infer<typeof readyResponseSchema>;
export type ReadyErrorResponse = z.infer<typeof readyErrorResponseSchema>;

export const healthContract = c.router({
  health: {
    method: "GET",
    path: "/health",
    responses: {
      200: healthResponseSchema,
    },
    summary: "Liveness check endpoint",
  },
  ready: {
    method: "GET",
    path: "/ready",
    responses: {
      200: readyResponseSchema,
      503: readyErrorResponseSchema,
    },
    summary: "Readiness check endpoint verifying database and redis connectivity",
  },
});
