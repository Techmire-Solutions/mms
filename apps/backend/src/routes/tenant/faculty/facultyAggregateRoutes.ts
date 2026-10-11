import type { FastifyPluginAsync } from "fastify";
import { type User } from "@mms/shared";
import { facultyUseCases } from "../../../faculty/use-cases/facultyUseCases.js";
import {
  registerMetricsRoute,
  registerCountRoute,
  registerWidgetAggregatesRoute,
  registerResolveRoute,
  registerLinkedContactIdsRoute,
} from "../../../lib/crudRouter.js";
import { sanitizeFacultyForUser } from "./facultyRouteHelpers.js";

/** Count, metrics, resolve, widget aggregates, and inline restore routes. */
export const facultyAggregateRoutes: FastifyPluginAsync = async (sub) => {
  registerCountRoute(sub, {
    collection: "faculty",
    loadCountFn: () => facultyUseCases.countFaculty(),
    errorMessagePrefix: "faculty",
  });

  registerMetricsRoute(sub, {
    collection: "faculty",
    loadMetricsFn: () => facultyUseCases.loadFacultyCommandMetrics(),
    errorMessagePrefix: "faculty",
  });

  registerWidgetAggregatesRoute(sub, {
    collection: "faculty",
    loadAggregatesFn: (queries) => facultyUseCases.loadFacultyWidgetAggregates(queries),
    errorMessagePrefix: "faculty",
  });

  registerResolveRoute(sub, {
    collection: "faculty",
    loadByIdsFn: async (ids, request) => {
      const faculty = await facultyUseCases.loadFacultyByIds(ids);
      return sanitizeFacultyForUser(faculty, request.user as User);
    },
    responseKey: "faculty",
    errorMessagePrefix: "faculty",
  });

  registerLinkedContactIdsRoute(sub, {
    collection: "faculty",
    loadLinkedContactIdsFn: (excludeId) => facultyUseCases.loadFacultyLinkedContactIds(excludeId),
    errorMessagePrefix: "faculty",
  });
};
