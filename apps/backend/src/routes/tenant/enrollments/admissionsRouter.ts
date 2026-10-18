import type { FastifyPluginAsync } from 'fastify';
import { initServer, type RouterImplementation } from '@ts-rest/fastify';
import { admissionsContract, ENROLLMENTS_MODULE_MANIFEST, type User } from '@mms/shared';
import { handleContractError } from '../../../lib/contractError.js';
import { standardRequestValidationErrorHandler } from '../../../lib/contractRegistration.js';
import type { ContractRouteArgs } from '../../../lib/contractRouterTypes.js';
import { canReadCollection, canWriteCollection } from '../../../services/rbacService.js';
import { admissionsUseCases } from '../../../enrollments/use-cases/admissionsUseCases.js';

type Contract = typeof admissionsContract;
const COLLECTION = ENROLLMENTS_MODULE_MANIFEST.collectionKey;
const forbidden = { status: 403 as const, body: { type: 'forbidden', message: 'Insufficient permissions' } };
const s = initServer();

/** `/api/enrollments/applications` — admissions queue (review public registrations). */
export const admissionsRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(admissionsContract, {
    list: async ({ query, request }: ContractRouteArgs<Contract['list']>) => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION)) return forbidden;
      try {
        return { status: 200 as const, body: await admissionsUseCases.list(String(request.tenant?.id ?? ''), query) };
      } catch (error) {
        return handleContractError(request, error, { status: 500, body: { type: 'server_error', message: 'Failed to load applications' } });
      }
    },
    metrics: async ({ query, request }: ContractRouteArgs<Contract['metrics']>) => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION)) return forbidden;
      try {
        return { status: 200 as const, body: await admissionsUseCases.metrics(String(request.tenant?.id ?? ''), query?.sessionId) };
      } catch (error) {
        return handleContractError(request, error, { status: 500, body: { type: 'server_error', message: 'Failed to load admissions metrics' } });
      }
    },
    review: async ({ body, request }: ContractRouteArgs<Contract['review']>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        return { status: 200 as const, body: await admissionsUseCases.review(String(request.tenant?.id ?? ''), body, user) };
      } catch (error) {
        return handleContractError(request, error, { status: 500, body: { type: 'server_error', message: 'Failed to review applications' } });
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), { requestValidationErrorHandler: standardRequestValidationErrorHandler });
};
