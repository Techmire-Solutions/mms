import type { FastifyPluginAsync } from 'fastify';
import {
  SESSIONS_MODULE_MANIFEST,
  sessionLookupKindParamsSchema,
  sessionLookupPutBodySchema,
  type SessionLookupKind,
} from '@mms/shared';
import { registerModuleLookupRoutes } from '../../../lib/registerModuleLookupRoutes.js';
import { canReadCollection } from '../../../services/rbacService.js';
import {
  loadSessionLookupsMap,
  replaceSessionLookupKind,
} from '../../../services/sessionLookupsService.js';
import { auditSession } from './sessionRouteHelpers.js';

export const sessionLookupRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleLookupRoutes<SessionLookupKind, string[]>(fastify, {
    canRead: (user) => canReadCollection(user, 'sessions'),
    setupWritePermission: SESSIONS_MODULE_MANIFEST.permissions.setupWrite,
    kindParamsSchema: sessionLookupKindParamsSchema,
    putBodySchema: sessionLookupPutBodySchema,
    loadMap: loadSessionLookupsMap,
    replaceKind: (kind, items) => replaceSessionLookupKind(kind, items),
    audit: auditSession,
    auditAction: 'session.lookups',
    loadError: 'Failed to load session lookups',
    saveError: 'Failed to save session lookups',
  });
};
