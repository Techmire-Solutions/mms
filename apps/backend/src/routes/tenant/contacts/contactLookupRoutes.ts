import type { FastifyPluginAsync } from 'fastify';
import {
  CONTACTS_MODULE_MANIFEST,
  contactLookupKindParamsSchema,
  contactLookupPutBodySchema,
  isContactLookupCountryKind,
  type ContactLookupKind,
  type ContactLookupCountryCode,
} from '@mms/shared';
import { registerModuleLookupRoutes } from '../../../lib/registerModuleLookupRoutes.js';
import { replyValidationError } from '../../../lib/zodRequest.js';
import { canReadContacts } from '../../../services/rbacService.js';
import {
  loadContactLookupsMap,
  replaceContactLookupKind,
} from '../../../services/contactLookupsService.js';
import { mirrorRelationshipLookupsFromPreferences } from '../../../services/contactPreferencesService.js';
import { auditContact } from './contactRouteHelpers.js';

/** Contacts Setup lookup option lists (typed `contact_lookups`). */
export const contactLookupRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleLookupRoutes<ContactLookupKind, string[] | ContactLookupCountryCode[]>(fastify, {
    canRead: canReadContacts,
    setupWritePermission: CONTACTS_MODULE_MANIFEST.permissions.setupWrite,
    kindParamsSchema: contactLookupKindParamsSchema,
    putBodySchema: contactLookupPutBodySchema,
    loadMap: loadContactLookupsMap,
    replaceKind: (kind, items) => replaceContactLookupKind(kind, items),
    audit: (user, action, summary, entityId) =>
      auditContact(user, action, summary, entityId),
    auditAction: 'contact.lookups',
    loadError: 'Failed to load contact lookups',
    saveError: 'Failed to save contact lookups',
    handlePutKind: async ({ user, kind, items, reply }) => {
      if (isContactLookupCountryKind(kind)) {
        const invalid = Array.isArray(items) && items.some((item) => typeof item === 'string');
        if (invalid) {
          return replyValidationError(reply, 'countryCodes items must be { country, code } objects');
        }
      } else {
        const invalid = Array.isArray(items) && items.some((item) => typeof item !== 'string');
        if (invalid) {
          return replyValidationError(reply, `${kind} items must be strings`);
        }
      }

      if (kind === 'relationships') {
        const saved = await mirrorRelationshipLookupsFromPreferences();
        await auditContact(
          user,
          'contact.lookups',
          `Mirrored contact lookup kind "relationships" from preferences (${saved.length} items)`,
          'lookups:relationships',
        );
        return reply.send({ success: true, kind, items: saved, mirroredFromPrefs: true });
      }

      return null;
    },
  });
};
