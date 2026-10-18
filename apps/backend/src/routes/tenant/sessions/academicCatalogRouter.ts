import type { FastifyPluginAsync } from 'fastify';
import { initServer, type RouterImplementation } from '@ts-rest/fastify';
import {
  academicCatalogContract,
  isQueryFlagTrue,
  roleHasPermission,
  SESSIONS_MODULE_MANIFEST,
  type User,
} from '@mms/shared';
import { handleContractError } from '../../../lib/contractError.js';
import { standardRequestValidationErrorHandler } from '../../../lib/contractRegistration.js';
import type { ContractRouteArgs } from '../../../lib/contractRouterTypes.js';
import { HttpDomainError } from '../../../lib/httpErrors.js';
import { canDeleteCollection, canReadCollection } from '../../../services/rbacService.js';
import { academicCatalogUseCases } from '../../../sessions/use-cases/academicCatalogUseCases.js';

type Contract = typeof academicCatalogContract;
const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;
const forbidden = { status: 403 as const, body: { type: 'forbidden', message: 'Insufficient permissions' } };
const s = initServer();

function tenantOf(request: ContractRouteArgs<Contract['list']>['request']): string {
  return String(request.tenant?.id ?? '');
}

function canWriteSetup(user: User): boolean {
  return roleHasPermission(user.role, SESSIONS_MODULE_MANIFEST.permissions.setupWrite);
}

function domainError(request: ContractRouteArgs<Contract['list']>['request'], error: unknown, message: string) {
  if (error instanceof HttpDomainError) {
    return { status: error.statusCode, body: { type: error.type, message: error.message } };
  }
  return handleContractError(request, error, { status: 500, body: { type: 'server_error', message } });
}

/** `/api/sessions/catalogs/:catalog` — session categories, programs, subjects (Sessions → Setup). */
export const academicCatalogRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(academicCatalogContract, {
    list: async ({ params, query, request }: ContractRouteArgs<Contract['list']>) => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION)) return forbidden;
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, COLLECTION)) return forbidden;
      try {
        return { status: 200 as const, body: { items: await academicCatalogUseCases.list(tenantOf(request), params.catalog, includeDeleted) } };
      } catch (error) {
        return domainError(request, error, 'Failed to load catalog');
      }
    },
    save: async ({ params, body, request }: ContractRouteArgs<Contract['save']>) => {
      const user = request.user as User;
      if (!canWriteSetup(user)) return forbidden;
      try {
        const item = await academicCatalogUseCases.save(tenantOf(request), params.catalog, params.id, body, user.id);
        return { status: 200 as const, body: { item } };
      } catch (error) {
        return domainError(request, error, 'Failed to save catalog entry');
      }
    },
    remove: async ({ params, request }: ContractRouteArgs<Contract['remove']>) => {
      const user = request.user as User;
      if (!canWriteSetup(user)) return forbidden;
      try {
        const removed = await academicCatalogUseCases.remove(tenantOf(request), params.catalog, params.id, user.id);
        if (!removed) return { status: 404 as const, body: { type: 'not_found', message: 'Entry not found' } };
        return { status: 200 as const, body: { success: true as const } };
      } catch (error) {
        return domainError(request, error, 'Failed to delete catalog entry');
      }
    },
    restore: async ({ params, request }: ContractRouteArgs<Contract['restore']>) => {
      const user = request.user as User;
      if (!canWriteSetup(user)) return forbidden;
      try {
        const item = await academicCatalogUseCases.restore(tenantOf(request), params.catalog, params.id, user.id);
        if (!item) return { status: 404 as const, body: { type: 'not_found', message: 'Entry not found in trash' } };
        return { status: 200 as const, body: { item } };
      } catch (error) {
        return domainError(request, error, 'Failed to restore catalog entry');
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), { requestValidationErrorHandler: standardRequestValidationErrorHandler });
};
