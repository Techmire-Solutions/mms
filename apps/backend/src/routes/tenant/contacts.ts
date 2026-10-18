import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import { contactUseCases } from "../../contacts/use-cases/contactUseCases.js";
import {
  registerMetricsRoute,
  registerCountRoute,
  registerResolveRoute,
  registerWidgetAggregatesRoute,
} from "../../lib/crudRouter.js";
import { contactGoogleSyncRoutes } from "./contacts/googleSyncRoutes.js";
import { contactOperationRoutes } from "./contacts/contactOperationRoutes.js";
import { contactCrudRoutes } from "./contacts/contactCrudRoutes.js";
import { contactSavedReportRoutes } from "./contacts/savedReportRoutes.js";
import { contactLookupRoutes } from "./contacts/contactLookupRoutes.js";
import { contactSetupConfigRoutes } from "./contacts/contactSetupConfigRoutes.js";
import { sanitizeForUser } from "./contacts/contactRouteHelpers.js";

/**
 * Server-first contact resource routes (TanStack Query on FE).
 */
export const contactRoutes: FastifyPluginAsync = async (fastify, _options) => {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "contacts");

  await fastify.register(
    async (sub) => {
      registerCountRoute(sub, {
        collection: "contacts",
        loadCountFn: () => contactUseCases.countContacts(),
        errorMessagePrefix: "contacts",
      });

      registerMetricsRoute(sub, {
        collection: "contacts",
        loadMetricsFn: () => contactUseCases.loadContactsCommandMetrics(),
        errorMessagePrefix: "contacts",
      });

      registerWidgetAggregatesRoute(sub, {
        collection: "contacts",
        loadAggregatesFn: (queries) => contactUseCases.loadContactsWidgetAggregates(queries),
        errorMessagePrefix: "contacts",
      });

      registerResolveRoute(sub, {
        collection: "contacts",
        loadByIdsFn: async (ids, request) => {
          const user = request.user as User;
          const contacts = await contactUseCases.loadContactsByIds(ids);
          return sanitizeForUser(contacts, user);
        },
        responseKey: "contacts",
        errorMessagePrefix: "contacts",
      });

      await sub.register(contactOperationRoutes);
      await sub.register(contactLookupRoutes);
      await sub.register(contactSetupConfigRoutes);

      await sub.register(contactSavedReportRoutes);
      await sub.register(contactGoogleSyncRoutes);
    },
    { prefix: "/api/contacts" },
  );

  await fastify.register(contactCrudRoutes);
};
