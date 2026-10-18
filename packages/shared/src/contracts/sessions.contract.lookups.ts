import { z } from 'zod';
import { sessionLookupPutBodySchema } from '../sessionLookupTypes.js';

const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

/** Sessions lookup lists (statuses, legacy types) — GET map/kind and PUT replace. */
export const sessionLookupContractEndpoints = {
  getLookups: {
    method: 'GET' as const,
    path: '/api/sessions/lookups',
    responses: { 200: z.object({ lookups: z.object({ statuses: z.array(z.string()), types: z.array(z.string()) }) }), 403: errorResponse, 500: errorResponse },
    summary: 'Get all lookups',
  },
  getLookupKind: {
    method: 'GET' as const,
    path: '/api/sessions/lookups/:kind',
    pathParams: z.object({ kind: z.string() }),
    responses: { 200: z.array(z.string()), 403: errorResponse, 500: errorResponse },
    summary: 'Get a specific lookup kind',
  },
  updateLookupKind: {
    method: 'PUT' as const,
    path: '/api/sessions/lookups/:kind',
    pathParams: z.object({ kind: z.string() }),
    body: sessionLookupPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), kind: z.string(), items: z.array(z.string()) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: 'Replace a specific lookup kind',
  },
};
