import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { studentUseCases } from "../../../students/use-cases/studentUseCases.js";
import {
  registerMetricsRoute,
  registerCountRoute,
  registerResolveRoute,
  registerWidgetAggregatesRoute,
  registerLinkedContactIdsRoute,
} from "../../../lib/crudRouter.js";
import { sanitizeStudentsForUser } from "./studentRouteHelpers.js";
import {
  isStudentInAssignedSections,
  resolveStudentAccessScope,
} from "../../../students/use-cases/studentUseCases.js";

/** Count, metrics, resolve, and widget aggregates routes. */
export const studentAggregateRoutes: FastifyPluginAsync = async (sub) => {
  registerCountRoute(sub, {
    collection: "students",
    loadCountFn: () => studentUseCases.countStudents(),
    errorMessagePrefix: "students",
  });

  registerMetricsRoute(sub, {
    collection: "students",
    loadMetricsFn: () => studentUseCases.loadStudentsCommandMetrics(),
    errorMessagePrefix: "student",
  });

  registerWidgetAggregatesRoute(sub, {
    collection: "students",
    loadAggregatesFn: (queries) => studentUseCases.loadStudentsWidgetAggregates(queries),
    errorMessagePrefix: "student",
  });

  registerResolveRoute(sub, {
    collection: "students",
    loadByIdsFn: async (ids, request) => {
      const user = request.user as User;
      const tenantId = String(request.tenant?.id);
      const scope = await resolveStudentAccessScope(tenantId, user);
      let allowedIds = ids;
      if (!scope.isUnrestricted) {
        if (scope.assignedSectionIds.length === 0) return [];
        const checks = await Promise.all(
          ids.map(async (id) =>
            (await isStudentInAssignedSections(tenantId, id, scope.assignedSectionIds)) ? id : null,
          ),
        );
        allowedIds = checks.filter((id): id is string => id !== null);
      }
      const students = await studentUseCases.loadStudentsByIds(allowedIds);
      return sanitizeStudentsForUser(students, user);
    },
    responseKey: "students",
    errorMessagePrefix: "students",
  });

  registerLinkedContactIdsRoute(sub, {
    collection: "students",
    loadLinkedContactIdsFn: (excludeId) => studentUseCases.loadStudentLinkedContactIds(excludeId),
    errorMessagePrefix: "students",
  });
};
