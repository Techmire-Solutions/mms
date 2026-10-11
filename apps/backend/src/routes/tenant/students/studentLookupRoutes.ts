import type { FastifyPluginAsync } from 'fastify';
import {
  STUDENTS_MODULE_MANIFEST,
  studentLookupKindParamsSchema,
  studentLookupPutBodySchema,
  type StudentLookupKind,
} from '@mms/shared';
import { registerModuleLookupRoutes } from '../../../lib/registerModuleLookupRoutes.js';
import { canReadCollection } from '../../../services/rbacService.js';
import {
  loadStudentLookupsMap,
  replaceStudentLookupKind,
} from '../../../services/studentLookupsService.js';
import { auditStudent } from './studentRouteHelpers.js';

/** Students Setup lookup option lists (typed `student_lookups`). */
export const studentLookupRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleLookupRoutes<StudentLookupKind, string[]>(fastify, {
    canRead: (user) => canReadCollection(user, 'students'),
    setupWritePermission: STUDENTS_MODULE_MANIFEST.permissions.setupWrite,
    kindParamsSchema: studentLookupKindParamsSchema,
    putBodySchema: studentLookupPutBodySchema,
    loadMap: loadStudentLookupsMap,
    replaceKind: (kind, items) => replaceStudentLookupKind(kind, items),
    audit: auditStudent,
    auditAction: 'student.lookups',
    loadError: 'Failed to load student lookups',
    saveError: 'Failed to save student lookups',
  });
};
