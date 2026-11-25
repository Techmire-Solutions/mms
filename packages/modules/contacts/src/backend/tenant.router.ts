import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/contracts";
import { contactUseCases } from "./use-cases/index.js";
import {
  registerMetricsRoute,
  registerCountRoute,
  registerResolveRoute,
  registerWidgetAggregatesRoute,
} from "@mms/be-core/http/crud";
import { contactGoogleSyncRoutes } from "./routes/tenant/googleSyncRoutes.js";
import { contactOperationRoutes } from "./routes/tenant/contactOperationRoutes.js";
import { contactCrudRoutes } from "./routes/tenant/contactCrudRoutes.js";
import { contactSavedReportRoutes } from "./routes/tenant/savedReportRoutes.js";
import { contactLookupRoutes } from "./routes/tenant/contactLookupRoutes.js";
import { contactSetupConfigRoutes } from "./routes/tenant/contactSetupConfigRoutes.js";
import { contactPickerRoutes } from "./routes/tenant/contactPickerRoutes.js";
import { sanitizeForUser } from "./routes/tenant/contactRouteHelpers.js";

/**
 * Server-first contact resource routes (TanStack Query on FE).
 */
export const contactRoutes: FastifyPluginAsync = async (fastify, _options) => {
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
  // Contract paths are absolute (`/api/contacts/picker`), so this registers on
  // the module-scoped root exactly like `contactCrudRoutes` — not inside the
  // `/api/contacts` prefix, which would double the prefix.
  await fastify.register(contactPickerRoutes);
};
