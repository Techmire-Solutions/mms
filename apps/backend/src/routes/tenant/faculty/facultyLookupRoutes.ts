import type { FastifyPluginAsync } from "fastify";
import {
  FACULTY_MODULE_MANIFEST,
  facultyLookupKindParamsSchema,
  facultyLookupPutBodySchema,
  type FacultyLookupKind,
} from "@mms/shared";
import { registerModuleLookupRoutes } from "../../../lib/registerModuleLookupRoutes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import {
  loadFacultyLookupsMap,
  replaceFacultyLookupKind,
} from "../../../faculty/use-cases/facultyLookupsService.js";
import { auditFaculty } from "./facultyRouteHelpers.js";

/** Faculty Setup lookup option lists (typed `faculty_lookups`). */
export const facultyLookupRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleLookupRoutes<FacultyLookupKind, string[]>(fastify, {
    canRead: (user) => canReadCollection(user, "faculty"),
    setupWritePermission: FACULTY_MODULE_MANIFEST.permissions.setupWrite,
    kindParamsSchema: facultyLookupKindParamsSchema,
    putBodySchema: facultyLookupPutBodySchema,
    loadMap: loadFacultyLookupsMap,
    replaceKind: (kind, items) => replaceFacultyLookupKind(kind, items),
    audit: auditFaculty,
    auditAction: "faculty.lookups",
    loadError: "Failed to load faculty lookups",
    saveError: "Failed to save faculty lookups",
  });
};
