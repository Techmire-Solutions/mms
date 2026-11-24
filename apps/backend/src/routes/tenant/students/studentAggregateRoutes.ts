import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { User } from "@mms/contracts";
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
  filterStudentIdsInAssignedSections,
  resolveStudentAccessScope,
} from "../../../students/use-cases/studentUseCases.js";

/**
 * Resolves the caller's section scope for read surfaces.
 * `undefined` means unrestricted; an array (possibly empty) means section-limited.
 */
async function resolveScopedSections(request: FastifyRequest): Promise<string[] | undefined> {
  const user = request.user as User;
  const tenantId = String(request.tenant?.id ?? "");
  const scope = await resolveStudentAccessScope(tenantId, user);
  return scope.isUnrestricted ? undefined : scope.assignedSectionIds;
}

/** Count, metrics, resolve, and widget aggregates routes. */
export const studentAggregateRoutes: FastifyPluginAsync = async (sub) => {
  registerCountRoute(sub, {
    collection: "students",
    loadCountFn: async (request) =>
      studentUseCases.countStudents({
        scopedSectionIds: await resolveScopedSections(request),
      }),
    errorMessagePrefix: "students",
  });

  registerMetricsRoute(sub, {
    collection: "students",
    loadMetricsFn: async (request) =>
      studentUseCases.loadStudentsCommandMetrics({
        scopedSectionIds: await resolveScopedSections(request),
      }),
    // Metrics are scope-filtered per caller; role-only keys would serve one teacher's
    // section numbers to another teacher in the same role.
    cacheVary: (request) => String((request.user as User | undefined)?.id ?? ""),
    errorMessagePrefix: "student",
  });

  registerWidgetAggregatesRoute(sub, {
    collection: "students",
    loadAggregatesFn: async (queries, request) =>
      studentUseCases.loadStudentsWidgetAggregates(queries, {
        scopedSectionIds: await resolveScopedSections(request),
      }),
    errorMessagePrefix: "student",
  });

  registerResolveRoute(sub, {
    collection: "students",
    loadByIdsFn: async (ids, request) => {
      const user = request.user as User;
      const tenantId = String(request.tenant?.id ?? "");
      const scopedSections = await resolveScopedSections(request);
      let allowedIds = ids;
      if (scopedSections) {
        if (scopedSections.length === 0) return [];
        allowedIds = await filterStudentIdsInAssignedSections(tenantId, ids, scopedSections);
        if (allowedIds.length === 0) return [];
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
