import type { FastifyRequest } from 'fastify';
import type { ZodType } from 'zod';
import type { Permission, User } from '@mms/shared';
import { roleHasPermission } from '@mms/shared';
import { handleContractError } from './contractError.js';

type ErrorBody = { type: string; message: string };

export type LookupKindPutResult<TItems> =
  | { status: 200; body: { success: true; kind: string; items: TItems } }
  | { status: 400 | 403; body: ErrorBody }
  | { status: number; body: ErrorBody };

/**
 * ts-rest handler for `PUT /lookups/:kind` (contract twin of `registerModuleLookupRoutes`).
 * Setup-write gated, Zod-validated, audited.
 */
export function createLookupKindPutHandler<TKind extends string, TItems>(options: {
  kinds: readonly TKind[];
  setupWritePermission: Permission;
  putBodySchema: ZodType<{ items: TItems }>;
  replaceKind: (kind: TKind, items: TItems) => Promise<TItems>;
  audit: (user: User, action: string, summary: string, entityId: string) => Promise<void>;
  auditAction: string;
  saveError: string;
}) {
  return async (args: { params: { kind: string }; body: unknown; request: FastifyRequest }): Promise<LookupKindPutResult<TItems>> => {
    const user = args.request.user as User;
    if (!roleHasPermission(user.role, options.setupWritePermission)) {
      return { status: 403, body: { type: 'forbidden', message: 'Insufficient permissions' } };
    }
    const kind = args.params.kind;
    if (!options.kinds.includes(kind as TKind)) {
      return { status: 400, body: { type: 'validation_error', message: `Unknown lookup kind: ${kind}` } };
    }
    const parsed = options.putBodySchema.safeParse(args.body);
    if (!parsed.success) {
      return { status: 400, body: { type: 'validation_error', message: parsed.error.issues.map((i) => i.message).join('; ') } };
    }
    try {
      const items = await options.replaceKind(kind as TKind, parsed.data.items);
      const count = Array.isArray(items) ? items.length : 0;
      await options.audit(user, options.auditAction, `Updated lookup kind "${kind}" (${count} items)`, `lookups:${kind}`);
      return { status: 200, body: { success: true, kind, items } };
    } catch (error: unknown) {
      return handleContractError(args.request, error, { status: 500, body: { type: 'database_error', message: options.saveError } });
    }
  };
}
