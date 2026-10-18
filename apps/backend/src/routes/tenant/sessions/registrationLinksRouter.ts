import type { FastifyPluginAsync } from 'fastify';
import { initServer, type RouterImplementation } from '@ts-rest/fastify';
import { registrationLinksContract, SESSIONS_MODULE_MANIFEST, type User } from '@mms/shared';
import { handleContractError } from '../../../lib/contractError.js';
import { standardRequestValidationErrorHandler } from '../../../lib/contractRegistration.js';
import type { ContractRouteArgs } from '../../../lib/contractRouterTypes.js';
import { canReadCollection, canWriteCollection } from '../../../services/rbacService.js';
import { registrationLinkUseCases } from '../../../sessions/use-cases/registrationLinkUseCases.js';

type Contract = typeof registrationLinksContract;
const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;
const forbidden = { status: 403 as const, body: { type: 'forbidden', message: 'Insufficient permissions' } };
const s = initServer();

/** `/api/sessions/:sessionId/registration-links` — shareable public registration links. */
export const registrationLinksRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(registrationLinksContract, {
    list: async ({ params, request }: ContractRouteArgs<Contract['list']>) => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION)) return forbidden;
      try {
        const items = await registrationLinkUseCases.list(String(request.tenant?.id ?? ''), params.sessionId);
        return { status: 200 as const, body: { items } };
      } catch (error) {
        return handleContractError(request, error, { status: 500, body: { type: 'server_error', message: 'Failed to load registration links' } });
      }
    },
    save: async ({ params, body, request }: ContractRouteArgs<Contract['save']>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        const item = await registrationLinkUseCases.save(String(request.tenant?.id ?? ''), params.sessionId, params.id, body, String(user.id));
        return { status: 200 as const, body: { item } };
      } catch (error) {
        return handleContractError(request, error, { status: 500, body: { type: 'server_error', message: 'Failed to save the registration link' } });
      }
    },
    remove: async ({ params, request }: ContractRouteArgs<Contract['remove']>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        const removed = await registrationLinkUseCases.remove(String(request.tenant?.id ?? ''), params.sessionId, params.id, String(user.id));
        if (!removed) return { status: 404 as const, body: { type: 'not_found', message: 'Registration link not found' } };
        return { status: 200 as const, body: { success: true as const } };
      } catch (error) {
        return handleContractError(request, error, { status: 500, body: { type: 'server_error', message: 'Failed to delete the registration link' } });
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), { requestValidationErrorHandler: standardRequestValidationErrorHandler });
};
