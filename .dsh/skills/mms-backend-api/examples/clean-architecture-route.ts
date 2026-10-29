// Clean Architecture Route Pattern (Reference: apps/backend/src/routes/tenant/contacts.ts)
import type { FastifyPluginAsync } from 'fastify';
import { authenticateTenant } from '../../middleware/authenticate.js';
import { canWriteCollection, canReadCollection } from '../../services/rbac.js';
import { contactUseCases } from '../../contacts/use-cases/index.js';
import { registerStandardTenantRoutes } from '../crudResourceRoutes.js';
import { insertContactSchema, updateContactSchema } from '@mms/shared';

export const contactsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', authenticateTenant);

  // Standard CRUD registration wired to the composition root (use-cases)
  registerStandardTenantRoutes(app, {
    resourceName: 'contacts',
    collectionName: 'contacts',
    readPermission: (user) => canReadCollection(user, 'contacts'),
    writePermission: (user) => canWriteCollection(user, 'contacts'),
    listFn: (ctx, query) => contactUseCases.listContacts(ctx, query),
    getByIdFn: (ctx, id, opts) => contactUseCases.getContactById(ctx, id, opts),
    createFn: (ctx, payload) => contactUseCases.createContact(ctx, payload),
    updateFn: (ctx, id, payload) => contactUseCases.updateContact(ctx, id, payload),
    deleteFn: (ctx, id, reason) => contactUseCases.softDeleteContact(ctx, id, reason),
    restoreFn: (ctx, id) => contactUseCases.restoreContact(ctx, id),
  });
};
